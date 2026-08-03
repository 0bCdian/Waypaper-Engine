package playlist

import (
	"context"
	"log/slog"
	"math/rand"
	"sync"
	"time"
)

type Scheduler interface {
	Start(callback func(index int) bool)
	Stop()
	Pause()
	Resume()
	NextChangeAt() *time.Time
	AfterManualNavigation(playlistImageIndex int)
}

type SchedulerConfig struct {
	Type        string // "timer", "time_of_day", "day_of_week", "manual"
	Interval    int    // seconds (for "timer")
	Order       string // "ordered" or "random"
	TotalImages int
	StartIndex  int
	// TimeSlots maps image indices to minutes-since-midnight (for time_of_day).
	TimeSlots []TimeSlot
	// TimerIndices + TimerCursor restore timer+random traversal (length must match TotalImages).
	TimerIndices []int
	TimerCursor  int
	// StartPaused constructs the scheduler already paused. Set when restoring a
	// playlist that was paused at shutdown, so Start() performs no initial
	// callback — pausing after Start() races the day_of_week immediate fire.
	StartPaused bool
}

// TimeSlot maps a minute-since-midnight to an image index.
type TimeSlot struct {
	Minutes    int
	ImageIndex int
}

func NewScheduler(cfg SchedulerConfig) Scheduler {
	switch cfg.Type {
	case "timer":
		return newTimerScheduler(cfg)
	case "time_of_day":
		return newTimeOfDayScheduler(cfg)
	case "day_of_week":
		return newDayOfWeekScheduler(cfg)
	default:
		return newManualScheduler(cfg)
	}
}

func timerReconcileSchedulerConfig(order string, n, row int) (startIdx int, timerIndices []int, timerCur int) {
	row = clampPlaylistIndex(row, n)
	if n <= 0 {
		return 0, nil, 0
	}
	if order == "random" {
		indices := make([]int, n)
		for i := range indices {
			indices[i] = i
		}
		rand.Shuffle(len(indices), func(i, j int) {
			indices[i], indices[j] = indices[j], indices[i]
		})
		for j, v := range indices {
			if v == row {
				return 0, indices, j
			}
		}
		return 0, indices, 0
	}
	return row, nil, 0
}

type timerSyncReq struct {
	playlistIdx int
	done        chan struct{}
}

type timerScheduler struct {
	mu           sync.Mutex
	interval     time.Duration
	order        string
	totalImages  int
	currentIndex int
	indices      []int
	callback     func(int) bool
	activeCancel context.CancelFunc
	stopCh       chan struct{}
	stopOnce     sync.Once
	paused       bool
	nextChange   *time.Time
	syncReqCh    chan timerSyncReq
	resumeCh     chan struct{}
}

func newTimerScheduler(cfg SchedulerConfig) *timerScheduler {
	s := &timerScheduler{
		interval:    time.Duration(cfg.Interval) * time.Second,
		order:       cfg.Order,
		totalImages: cfg.TotalImages,
		stopCh:      make(chan struct{}),
		syncReqCh:   make(chan timerSyncReq),
		resumeCh:    make(chan struct{}, 1),
	}
	if len(cfg.TimerIndices) == cfg.TotalImages && cfg.TotalImages > 0 {
		s.indices = append([]int(nil), cfg.TimerIndices...)
		ci := cfg.TimerCursor
		if ci < 0 || ci >= len(s.indices) {
			ci = 0
		}
		s.currentIndex = ci
	} else {
		s.currentIndex = cfg.StartIndex
		s.indices = s.buildIndices()
	}
	s.paused = cfg.StartPaused
	return s
}

func TimerTraversalSnapshot(s Scheduler) ([]int, int, bool) {
	ts, ok := s.(*timerScheduler)
	if !ok {
		return nil, 0, false
	}
	idx, cur := ts.snapshotTraversal()
	return idx, cur, true
}

func (s *timerScheduler) snapshotTraversal() ([]int, int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]int, len(s.indices))
	copy(out, s.indices)
	return out, s.currentIndex
}

func (s *timerScheduler) buildIndices() []int {
	indices := make([]int, s.totalImages)
	for i := range indices {
		indices[i] = i
	}
	if s.order == "random" {
		rand.Shuffle(len(indices), func(i, j int) {
			indices[i], indices[j] = indices[j], indices[i]
		})
	}
	return indices
}

func (s *timerScheduler) Start(callback func(int) bool) {
	s.mu.Lock()
	s.callback = callback
	if !s.paused {
		n := time.Now().Add(s.interval)
		s.nextChange = &n
	}
	s.mu.Unlock()
	go s.runLoop()
}

func (s *timerScheduler) runLoop() {
	for {
		s.mu.Lock()
		if s.paused {
			s.nextChange = nil
			s.mu.Unlock()
			select {
			case <-s.stopCh:
				return
			case req := <-s.syncReqCh:
				s.syncToPlaylistIndexAndRelease(req)
			case <-s.resumeCh:
			}
			continue
		}

		wait := s.interval
		deadline := time.Now().Add(wait)
		s.nextChange = &deadline
		ctx, cancel := context.WithCancel(context.Background())
		s.activeCancel = cancel
		s.mu.Unlock()

		waitDone := make(chan struct{})
		timerDidFire := make(chan struct{}, 1)
		go func(d time.Duration) {
			defer close(waitDone)
			t := time.NewTimer(d)
			defer t.Stop()
			select {
			case <-t.C:
				select {
				case timerDidFire <- struct{}{}:
				default:
				}
			case <-ctx.Done():
			}
		}(wait)

		var fired bool
		select {
		case <-s.stopCh:
			cancel()
			s.mu.Lock()
			s.activeCancel = nil
			s.mu.Unlock()
			<-waitDone
			return
		case req := <-s.syncReqCh:
			cancel()
			s.mu.Lock()
			s.activeCancel = nil
			s.mu.Unlock()
			<-waitDone
			s.syncToPlaylistIndexAndRelease(req)
			continue
		case <-waitDone:
			cancel()
			s.mu.Lock()
			s.activeCancel = nil
			select {
			case <-timerDidFire:
				fired = true
			default:
			}
			if !fired || s.paused {
				s.mu.Unlock()
				continue
			}
			nextPos := (s.currentIndex + 1) % len(s.indices)
			imgIdx := s.indices[nextPos]
			cb := s.callback
			deadline := time.Now().Add(s.interval)
			s.nextChange = &deadline
			s.mu.Unlock()

			ok := true
			if cb != nil {
				ok = cb(imgIdx)
				if !ok {
					slog.Debug("timer scheduler tick skipped (onTick returned false)",
						"playlist_row_index", imgIdx)
				}
			}

			s.mu.Lock()
			if ok {
				s.currentIndex = nextPos
			}
			s.mu.Unlock()
		}
	}
}

func (s *timerScheduler) syncToPlaylistIndexAndRelease(req timerSyncReq) {
	s.mu.Lock()
	if s.activeCancel != nil {
		s.activeCancel()
		s.activeCancel = nil
	}
	for j, v := range s.indices {
		if v == req.playlistIdx {
			s.currentIndex = j
			break
		}
	}
	if !s.paused {
		n := time.Now().Add(s.interval)
		s.nextChange = &n
	} else {
		s.nextChange = nil
	}
	s.mu.Unlock()
	close(req.done)
}

func (s *timerScheduler) AfterManualNavigation(playlistImageIndex int) {
	done := make(chan struct{})
	req := timerSyncReq{playlistIdx: playlistImageIndex, done: done}
	select {
	case s.syncReqCh <- req:
		<-done
	case <-s.stopCh:
	}
}

func (s *timerScheduler) Stop() {
	s.stopOnce.Do(func() {
		close(s.stopCh)
		s.mu.Lock()
		if s.activeCancel != nil {
			s.activeCancel()
			s.activeCancel = nil
		}
		s.nextChange = nil
		s.mu.Unlock()
	})
}

func (s *timerScheduler) Pause() {
	s.mu.Lock()
	s.paused = true
	if s.activeCancel != nil {
		s.activeCancel()
		s.activeCancel = nil
	}
	s.nextChange = nil
	s.mu.Unlock()
}

func (s *timerScheduler) Resume() {
	s.mu.Lock()
	s.paused = false
	deadline := time.Now().Add(s.interval)
	s.nextChange = &deadline
	s.mu.Unlock()
	select {
	case s.resumeCh <- struct{}{}:
	default:
	}
}

func (s *timerScheduler) NextChangeAt() *time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.nextChange == nil {
		return nil
	}
	t := wallClock(*s.nextChange)
	return &t
}

type timeOfDayScheduler struct {
	mu         sync.Mutex
	slots      []TimeSlot
	callback   func(int) bool
	stopCh     chan struct{}
	stopOnce   sync.Once
	paused     bool
	nextChange *time.Time
	resumeCh   chan struct{}
}

func newTimeOfDayScheduler(cfg SchedulerConfig) *timeOfDayScheduler {
	return &timeOfDayScheduler{
		slots:    cfg.TimeSlots,
		stopCh:   make(chan struct{}),
		resumeCh: make(chan struct{}, 1),
		paused:   cfg.StartPaused,
	}
}

func (s *timeOfDayScheduler) Start(callback func(int) bool) {
	s.mu.Lock()
	s.callback = callback
	if !s.paused {
		if _, dur := s.nextTransition(); dur > 0 {
			next := time.Now().Add(dur)
			s.nextChange = &next
		}
	}
	s.mu.Unlock()

	go s.loop()
}

func (s *timeOfDayScheduler) loop() {
	for {
		s.mu.Lock()
		paused := s.paused
		s.mu.Unlock()

		if paused {
			select {
			case <-s.stopCh:
				return
			case <-s.resumeCh:
			}
			continue
		}

		nextSlot, dur := s.nextTransition()
		if nextSlot == nil {
			return
		}

		s.mu.Lock()
		next := time.Now().Add(dur)
		s.nextChange = &next
		s.mu.Unlock()

		timer := time.NewTimer(dur)
		select {
		case <-s.stopCh:
			timer.Stop()
			return
		case <-s.resumeCh:
			timer.Stop()
			continue
		case <-timer.C:
			s.mu.Lock()
			stillRunning := !s.paused
			cb := s.callback
			s.mu.Unlock()
			if stillRunning && cb != nil {
				_ = cb(nextSlot.ImageIndex)
			}
		}
	}
}

func (s *timeOfDayScheduler) nextTransition() (*TimeSlot, time.Duration) {
	if len(s.slots) == 0 {
		return nil, 0
	}

	now := time.Now()
	nowMinutes := now.Hour()*60 + now.Minute()

	for i := range s.slots {
		if s.slots[i].Minutes > nowMinutes {
			target := todayAt(s.slots[i].Minutes)
			return &s.slots[i], time.Until(target)
		}
	}

	target := todayAt(s.slots[0].Minutes).Add(24 * time.Hour)
	return &s.slots[0], time.Until(target)
}

func todayAt(minutesSinceMidnight int) time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(),
		minutesSinceMidnight/60, minutesSinceMidnight%60, 0, 0, now.Location())
}

func (s *timeOfDayScheduler) Stop() {
	s.stopOnce.Do(func() {
		close(s.stopCh)
		s.mu.Lock()
		s.nextChange = nil
		s.mu.Unlock()
	})
}

func (s *timeOfDayScheduler) Pause() {
	s.mu.Lock()
	s.paused = true
	s.nextChange = nil
	s.mu.Unlock()
}

func (s *timeOfDayScheduler) Resume() {
	s.mu.Lock()
	s.paused = false
	if _, dur := s.nextTransition(); dur > 0 {
		next := time.Now().Add(dur)
		s.nextChange = &next
	}
	s.mu.Unlock()

	select {
	case s.resumeCh <- struct{}{}:
	default:
	}
}

func (s *timeOfDayScheduler) NextChangeAt() *time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.nextChange == nil {
		return nil
	}
	t := wallClock(*s.nextChange)
	return &t
}

func (s *timeOfDayScheduler) AfterManualNavigation(_ int) {}

type dayOfWeekScheduler struct {
	mu          sync.Mutex
	totalImages int
	callback    func(int) bool
	stopCh      chan struct{}
	stopOnce    sync.Once
	paused      bool
	nextChange  *time.Time
	resumeCh    chan struct{}
}

func newDayOfWeekScheduler(cfg SchedulerConfig) *dayOfWeekScheduler {
	return &dayOfWeekScheduler{
		totalImages: cfg.TotalImages,
		stopCh:      make(chan struct{}),
		resumeCh:    make(chan struct{}, 1),
		paused:      cfg.StartPaused,
	}
}

func (s *dayOfWeekScheduler) Start(callback func(int) bool) {
	s.mu.Lock()
	s.callback = callback
	paused := s.paused
	if !paused {
		now := time.Now()
		tomorrow := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
		s.nextChange = &tomorrow
	}
	s.mu.Unlock()

	go func() {
		if !paused {
			weekday := int(time.Now().Weekday())
			idx := min(weekday, s.totalImages-1)
			s.mu.Lock()
			cb := s.callback
			s.mu.Unlock()
			if cb != nil {
				_ = cb(idx)
			}
		}
		s.scheduleNext()
	}()
}

func (s *dayOfWeekScheduler) scheduleNext() {
	for {
		s.mu.Lock()
		paused := s.paused
		s.mu.Unlock()

		if paused {
			select {
			case <-s.stopCh:
				return
			case <-s.resumeCh:
			}
			continue
		}

		now := time.Now()
		tomorrow := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
		dur := time.Until(tomorrow)

		s.mu.Lock()
		s.nextChange = &tomorrow
		s.mu.Unlock()

		timer := time.NewTimer(dur)
		select {
		case <-s.stopCh:
			timer.Stop()
			return
		case <-s.resumeCh:
			timer.Stop()
			continue
		case <-timer.C:
			s.mu.Lock()
			stillRunning := !s.paused
			cb := s.callback
			s.mu.Unlock()
			if stillRunning && cb != nil {
				weekday := int(time.Now().Weekday())
				idx := min(weekday, s.totalImages-1)
				_ = cb(idx)
			}
		}
	}
}

func (s *dayOfWeekScheduler) Stop() {
	s.stopOnce.Do(func() {
		close(s.stopCh)
		s.mu.Lock()
		s.nextChange = nil
		s.mu.Unlock()
	})
}

func (s *dayOfWeekScheduler) Pause() {
	s.mu.Lock()
	s.paused = true
	s.nextChange = nil
	s.mu.Unlock()
}

func (s *dayOfWeekScheduler) Resume() {
	s.mu.Lock()
	s.paused = false
	now := time.Now()
	tomorrow := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
	s.nextChange = &tomorrow
	s.mu.Unlock()

	select {
	case s.resumeCh <- struct{}{}:
	default:
	}
}

func (s *dayOfWeekScheduler) NextChangeAt() *time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.nextChange == nil {
		return nil
	}
	t := wallClock(*s.nextChange)
	return &t
}

func (s *dayOfWeekScheduler) AfterManualNavigation(_ int) {}

type manualScheduler struct {
	totalImages  int
	currentIndex int
}

func newManualScheduler(cfg SchedulerConfig) *manualScheduler {
	return &manualScheduler{
		totalImages:  cfg.TotalImages,
		currentIndex: cfg.StartIndex,
	}
}

func (s *manualScheduler) Start(_ func(int) bool) {}

func (s *manualScheduler) Stop() {}

func (s *manualScheduler) Pause() {}

func (s *manualScheduler) Resume() {}

func (s *manualScheduler) NextChangeAt() *time.Time { return nil }

func (s *manualScheduler) AfterManualNavigation(_ int) {}

func wallClock(t time.Time) time.Time {
	return t.Round(0)
}
