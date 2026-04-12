package playlist

import (
	"context"
	"math/rand"
	"sync"
	"time"
)

// Scheduler controls the timing of playlist image transitions.
type Scheduler interface {
	// Start begins the scheduler. The provided callback is called on each tick
	// with the next image index.
	Start(callback func(index int))

	// Stop permanently stops the scheduler.
	Stop()

	// Pause temporarily suspends ticking.
	Pause()

	// Resume resumes a paused scheduler.
	Resume()

	// NextChangeAt returns when the next transition will occur, or nil if unknown.
	NextChangeAt() *time.Time

	// AfterManualNavigation informs the scheduler that the user moved to the given
	// playlist image index. Timer schedulers align shuffle position and restart the
	// interval from now; other schedulers no-op.
	AfterManualNavigation(playlistImageIndex int)
}

// SchedulerConfig contains all information needed to create a scheduler.
type SchedulerConfig struct {
	Type        string // "timer", "time_of_day", "day_of_week", "manual"
	Interval    int    // seconds (for "timer")
	Order       string // "ordered" or "random"
	TotalImages int
	StartIndex  int
	// TimeSlots maps image indices to minutes-since-midnight (for time_of_day).
	TimeSlots []TimeSlot
}

// TimeSlot maps a minute-since-midnight to an image index.
type TimeSlot struct {
	Minutes    int
	ImageIndex int
}

// NewScheduler creates the appropriate Scheduler based on config.
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

// --- Timer Scheduler ---

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
	callback     func(int)
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
		interval:     time.Duration(cfg.Interval) * time.Second,
		order:        cfg.Order,
		totalImages:  cfg.TotalImages,
		currentIndex: cfg.StartIndex,
		stopCh:       make(chan struct{}),
		syncReqCh:    make(chan timerSyncReq),
		resumeCh:     make(chan struct{}, 1),
	}
	s.indices = s.buildIndices()
	return s
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

func (s *timerScheduler) Start(callback func(int)) {
	s.mu.Lock()
	s.callback = callback
	n := time.Now().Add(s.interval)
	s.nextChange = &n
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
			s.currentIndex = (s.currentIndex + 1) % len(s.indices)
			imgIdx := s.indices[s.currentIndex]
			cb := s.callback
			next := time.Now().Add(s.interval)
			s.nextChange = &next
			s.mu.Unlock()

			// Callback must run without s.mu: Manager.onTick calls sched.NextChangeAt(),
			// and HTTP handlers call AfterManualNavigation which needs the runLoop select.
			if cb != nil {
				cb(imgIdx)
			}
		}
	}
}

// syncToPlaylistIndexAndRelease updates shuffle position to match the playlist
// row index now showing, refreshes NextChangeAt when unpaused, and unblocks the
// caller. The next runLoop iteration starts a fresh wait.
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
	t := *s.nextChange
	return &t
}

// --- Time-of-Day Scheduler ---

type timeOfDayScheduler struct {
	mu         sync.Mutex
	slots      []TimeSlot
	callback   func(int)
	timer      *time.Timer
	stopCh     chan struct{}
	stopOnce   sync.Once
	paused     bool
	nextChange *time.Time
}

func newTimeOfDayScheduler(cfg SchedulerConfig) *timeOfDayScheduler {
	return &timeOfDayScheduler{
		slots:  cfg.TimeSlots,
		stopCh: make(chan struct{}),
	}
}

func (s *timeOfDayScheduler) Start(callback func(int)) {
	s.mu.Lock()
	s.callback = callback
	s.mu.Unlock()

	go s.loop()
}

func (s *timeOfDayScheduler) loop() {
	for {
		nextSlot, dur := s.nextTransition()
		if nextSlot == nil {
			return
		}

		s.mu.Lock()
		next := time.Now().Add(dur)
		s.nextChange = &next
		s.timer = time.NewTimer(dur)
		s.mu.Unlock()

		select {
		case <-s.stopCh:
			s.timer.Stop()
			return
		case <-s.timer.C:
			s.mu.Lock()
			paused := s.paused
			cb := s.callback
			s.mu.Unlock()

			if !paused && cb != nil {
				cb(nextSlot.ImageIndex)
			}
		}
	}
}

// nextTransition returns the next time slot and duration until it fires.
func (s *timeOfDayScheduler) nextTransition() (*TimeSlot, time.Duration) {
	if len(s.slots) == 0 {
		return nil, 0
	}

	now := time.Now()
	nowMinutes := now.Hour()*60 + now.Minute()

	// Find the next slot today.
	for i := range s.slots {
		if s.slots[i].Minutes > nowMinutes {
			target := todayAt(s.slots[i].Minutes)
			return &s.slots[i], time.Until(target)
		}
	}

	// Wrap to first slot tomorrow.
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
		s.mu.Lock()
		defer s.mu.Unlock()

		close(s.stopCh)
		if s.timer != nil {
			s.timer.Stop()
		}
		s.nextChange = nil
	})
}

func (s *timeOfDayScheduler) Pause() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.paused = true
	if s.timer != nil {
		s.timer.Stop()
	}
	s.nextChange = nil
}

func (s *timeOfDayScheduler) Resume() {
	s.mu.Lock()
	s.paused = false
	s.mu.Unlock()

	go s.loop()
}

func (s *timeOfDayScheduler) NextChangeAt() *time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.nextChange == nil {
		return nil
	}
	t := *s.nextChange
	return &t
}

func (s *timeOfDayScheduler) AfterManualNavigation(_ int) {}

// --- Day-of-Week Scheduler ---

type dayOfWeekScheduler struct {
	mu          sync.Mutex
	totalImages int
	callback    func(int)
	timer       *time.Timer
	stopCh      chan struct{}
	stopOnce    sync.Once
	paused      bool
	nextChange  *time.Time
}

func newDayOfWeekScheduler(cfg SchedulerConfig) *dayOfWeekScheduler {
	return &dayOfWeekScheduler{
		totalImages: cfg.TotalImages,
		stopCh:      make(chan struct{}),
	}
}

func (s *dayOfWeekScheduler) Start(callback func(int)) {
	s.mu.Lock()
	s.callback = callback
	s.mu.Unlock()

	// Fire immediately for today's weekday.
	go func() {
		weekday := int(time.Now().Weekday())
		idx := min(weekday, s.totalImages-1)
		s.mu.Lock()
		cb := s.callback
		s.mu.Unlock()
		if cb != nil {
			cb(idx)
		}
		s.scheduleNext()
	}()
}

func (s *dayOfWeekScheduler) scheduleNext() {
	for {
		now := time.Now()
		tomorrow := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
		dur := time.Until(tomorrow)

		s.mu.Lock()
		s.nextChange = &tomorrow
		s.timer = time.NewTimer(dur)
		s.mu.Unlock()

		select {
		case <-s.stopCh:
			s.timer.Stop()
			return
		case <-s.timer.C:
			s.mu.Lock()
			paused := s.paused
			cb := s.callback
			s.mu.Unlock()

			if !paused && cb != nil {
				weekday := int(time.Now().Weekday())
				idx := min(weekday, s.totalImages-1)
				cb(idx)
			}
		}
	}
}

func (s *dayOfWeekScheduler) Stop() {
	s.stopOnce.Do(func() {
		s.mu.Lock()
		defer s.mu.Unlock()

		close(s.stopCh)
		if s.timer != nil {
			s.timer.Stop()
		}
		s.nextChange = nil
	})
}

func (s *dayOfWeekScheduler) Pause() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.paused = true
	if s.timer != nil {
		s.timer.Stop()
	}
	s.nextChange = nil
}

func (s *dayOfWeekScheduler) Resume() {
	s.mu.Lock()
	s.paused = false
	s.mu.Unlock()

	go s.scheduleNext()
}

func (s *dayOfWeekScheduler) NextChangeAt() *time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.nextChange == nil {
		return nil
	}
	t := *s.nextChange
	return &t
}

func (s *dayOfWeekScheduler) AfterManualNavigation(_ int) {}

// --- Manual Scheduler ---

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

// Start is a no-op for manual scheduler.
func (s *manualScheduler) Start(_ func(int)) {}

// Stop is a no-op for manual scheduler.
func (s *manualScheduler) Stop() {}

// Pause is a no-op for manual scheduler.
func (s *manualScheduler) Pause() {}

// Resume is a no-op for manual scheduler.
func (s *manualScheduler) Resume() {}

// NextChangeAt always returns nil for manual scheduler.
func (s *manualScheduler) NextChangeAt() *time.Time { return nil }

func (s *manualScheduler) AfterManualNavigation(_ int) {}
