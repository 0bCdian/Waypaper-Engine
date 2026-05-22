package playlist

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/store"
)

func TestFindClosestTimeSlot(t *testing.T) {
	now := time.Now()
	currentMinutes := now.Hour()*60 + now.Minute()

	tests := []struct {
		name     string
		slots    []TimeSlot
		expected int
	}{
		{
			name:     "empty slots returns 0",
			slots:    nil,
			expected: 0,
		},
		{
			name: "all slots in future wraps to last",
			slots: []TimeSlot{
				{Minutes: currentMinutes + 60, ImageIndex: 3},
				{Minutes: currentMinutes + 120, ImageIndex: 5},
			},
			expected: 5,
		},
		{
			name: "exact match on current time",
			slots: []TimeSlot{
				{Minutes: currentMinutes - 60, ImageIndex: 0},
				{Minutes: currentMinutes, ImageIndex: 1},
				{Minutes: currentMinutes + 60, ImageIndex: 2},
			},
			expected: 1,
		},
		{
			name: "between two slots returns earlier",
			slots: []TimeSlot{
				{Minutes: currentMinutes - 120, ImageIndex: 10},
				{Minutes: currentMinutes - 30, ImageIndex: 20},
				{Minutes: currentMinutes + 60, ImageIndex: 30},
			},
			expected: 20,
		},
		{
			name: "after all slots returns last",
			slots: []TimeSlot{
				{Minutes: currentMinutes - 180, ImageIndex: 0},
				{Minutes: currentMinutes - 60, ImageIndex: 1},
			},
			expected: 1,
		},
		{
			name: "single slot before now",
			slots: []TimeSlot{
				{Minutes: currentMinutes - 10, ImageIndex: 7},
			},
			expected: 7,
		},
		{
			name: "single slot after now wraps",
			slots: []TimeSlot{
				{Minutes: currentMinutes + 10, ImageIndex: 7},
			},
			expected: 7,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := findClosestTimeSlot(tt.slots)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestBuildTimeSlots(t *testing.T) {
	min60 := 60
	min120 := 120

	pl := &store.Playlist{
		Images: []store.PlaylistImage{
			{ImageID: 1, Time: &min60},
			{ImageID: 2, Time: nil},
			{ImageID: 3, Time: &min120},
		},
	}

	slots := buildTimeSlots(pl)
	require.Len(t, slots, 2)
	assert.Equal(t, TimeSlot{Minutes: 60, ImageIndex: 0}, slots[0])
	assert.Equal(t, TimeSlot{Minutes: 120, ImageIndex: 2}, slots[1])
}

func TestBuildTimeSlotsSortsByMinutes(t *testing.T) {
	min900 := 900
	min600 := 600
	pl := &store.Playlist{
		Images: []store.PlaylistImage{
			{ImageID: 11, Time: &min900},
			{ImageID: 22, Time: &min600},
		},
	}
	slots := buildTimeSlots(pl)
	require.Len(t, slots, 2)
	assert.Equal(t, TimeSlot{Minutes: 600, ImageIndex: 1}, slots[0])
	assert.Equal(t, TimeSlot{Minutes: 900, ImageIndex: 0}, slots[1])
}

func TestBuildTimeSlotsEmpty(t *testing.T) {
	pl := &store.Playlist{
		Images: []store.PlaylistImage{
			{ImageID: 1, Time: nil},
			{ImageID: 2, Time: nil},
		},
	}

	slots := buildTimeSlots(pl)
	assert.Empty(t, slots)
}

func TestComputeInitialState(t *testing.T) {
	t.Run("always start on first image", func(t *testing.T) {
		pl := &store.Playlist{
			Configuration: store.PlaylistConfiguration{
				Type:                    "timer",
				AlwaysStartOnFirstImage: true,
			},
			Images: []store.PlaylistImage{{ImageID: 1}, {ImageID: 2}},
		}
		_, idx := computeInitialState(pl)
		assert.Equal(t, 0, idx)
	})

	t.Run("timer type starts at 0", func(t *testing.T) {
		pl := &store.Playlist{
			Configuration: store.PlaylistConfiguration{
				Type: "timer",
			},
			Images: []store.PlaylistImage{{ImageID: 1}, {ImageID: 2}},
		}
		_, idx := computeInitialState(pl)
		assert.Equal(t, 0, idx)
	})

	t.Run("manual type starts at 0", func(t *testing.T) {
		pl := &store.Playlist{
			Configuration: store.PlaylistConfiguration{
				Type: "manual",
			},
			Images: []store.PlaylistImage{{ImageID: 1}, {ImageID: 2}},
		}
		_, idx := computeInitialState(pl)
		assert.Equal(t, 0, idx)
	})

	t.Run("day_of_week type uses current weekday", func(t *testing.T) {
		images := make([]store.PlaylistImage, 7)
		for i := range images {
			images[i] = store.PlaylistImage{ImageID: i + 1}
		}
		pl := &store.Playlist{
			Configuration: store.PlaylistConfiguration{
				Type: "day_of_week",
			},
			Images: images,
		}
		_, idx := computeInitialState(pl)
		expected := int(time.Now().Weekday())
		assert.Equal(t, expected, idx)
	})

	t.Run("day_of_week capped to image count", func(t *testing.T) {
		pl := &store.Playlist{
			Configuration: store.PlaylistConfiguration{
				Type: "day_of_week",
			},
			Images: []store.PlaylistImage{{ImageID: 1}},
		}
		_, idx := computeInitialState(pl)
		assert.Equal(t, 0, idx)
	})
}

func TestNewSchedulerTypes(t *testing.T) {
	tests := []struct {
		name    string
		cfgType string
	}{
		{"timer", "timer"},
		{"time_of_day", "time_of_day"},
		{"day_of_week", "day_of_week"},
		{"manual", "manual"},
		{"unknown defaults to manual", "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sched := NewScheduler(SchedulerConfig{
				Type:        tt.cfgType,
				Interval:    1,
				Order:       "ordered",
				TotalImages: 3,
				StartIndex:  0,
			})
			require.NotNil(t, sched)
		})
	}
}

func TestTimerSchedulerRestoreTraversal(t *testing.T) {
	restored := []int{2, 0, 1}
	sched := NewScheduler(SchedulerConfig{
		Type:         "timer",
		Interval:     1,
		Order:        "random",
		TotalImages:  3,
		StartIndex:   0,
		TimerIndices: restored,
		TimerCursor:  1,
	})
	idx, cur, ok := TimerTraversalSnapshot(sched)
	require.True(t, ok)
	assert.Equal(t, restored, idx)
	assert.Equal(t, 1, cur)

	ts := sched.(*timerScheduler)
	ts.interval = 25 * time.Millisecond
	tickCh := make(chan int, 2)
	sched.Start(func(i int) bool { tickCh <- i; return true })
	select {
	case v := <-tickCh:
		assert.Equal(t, 1, v, "first tick should follow restored order after cursor")
	case <-time.After(400 * time.Millisecond):
		t.Fatal("timeout waiting for tick")
	}
	sched.Stop()
}

func TestTimerSchedulerStartAndTick(t *testing.T) {
	tickCh := make(chan int, 100)

	sched := NewScheduler(SchedulerConfig{
		Type:        "timer",
		Interval:    1,
		Order:       "ordered",
		TotalImages: 5,
		StartIndex:  0,
	})

	ts := sched.(*timerScheduler)
	ts.interval = 20 * time.Millisecond

	sched.Start(func(index int) bool {
		tickCh <- index
		return true
	})
	defer sched.Stop()

	next := sched.NextChangeAt()
	require.NotNil(t, next, "NextChangeAt should be set after Start")

	select {
	case <-tickCh:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("expected at least one tick within 200ms")
	}
}

func TestTimerSchedulerPauseStopsTicking(t *testing.T) {
	var count atomic.Int32

	sched := NewScheduler(SchedulerConfig{
		Type:        "timer",
		Interval:    1,
		Order:       "ordered",
		TotalImages: 5,
		StartIndex:  0,
	})

	ts := sched.(*timerScheduler)
	ts.interval = 10 * time.Millisecond

	sched.Start(func(index int) bool {
		count.Add(1)
		return true
	})
	defer sched.Stop()

	time.Sleep(50 * time.Millisecond)
	sched.Pause()
	assert.Nil(t, sched.NextChangeAt(), "NextChangeAt should be nil after Pause")

	countBefore := count.Load()
	time.Sleep(50 * time.Millisecond)
	countAfter := count.Load()
	assert.Equal(t, countBefore, countAfter, "no ticks should occur while paused")
}

func TestTimerSchedulerResumeNextChangeAtImmediate(t *testing.T) {
	sched := NewScheduler(SchedulerConfig{
		Type:        "timer",
		Interval:    1,
		Order:       "ordered",
		TotalImages: 2,
		StartIndex:  0,
	})
	ts := sched.(*timerScheduler)
	ts.interval = 5 * time.Minute

	sched.Start(func(int) bool { return true })
	defer sched.Stop()

	sched.Pause()
	assert.Nil(t, sched.NextChangeAt())

	sched.Resume()
	n := sched.NextChangeAt()
	require.NotNil(t, n, "NextChangeAt must be set synchronously so API clients can show the timer")
	now := time.Now()
	assert.True(t, n.After(now) || n.Equal(now), "deadline should be in the near future")
	assert.Less(t, n.Sub(now), 6*time.Minute)
}

func TestTimerSchedulerStop(t *testing.T) {
	sched := NewScheduler(SchedulerConfig{
		Type:        "timer",
		Interval:    1,
		Order:       "ordered",
		TotalImages: 5,
		StartIndex:  0,
	})

	ts := sched.(*timerScheduler)
	ts.interval = 20 * time.Millisecond

	sched.Start(func(index int) bool { return true })
	sched.Stop()
	assert.Nil(t, sched.NextChangeAt(), "NextChangeAt should be nil after Stop")
}

func TestManualSchedulerNoOps(t *testing.T) {
	sched := NewScheduler(SchedulerConfig{
		Type:        "manual",
		TotalImages: 3,
		StartIndex:  1,
	})

	sched.Start(func(int) bool { return true })

	assert.Nil(t, sched.NextChangeAt())

	sched.Pause()
	sched.Resume()
	sched.Stop()
}

func TestTimerSchedulerTickCallbackMayCallNextChangeAt(t *testing.T) {
	sched := NewScheduler(SchedulerConfig{
		Type:        "timer",
		Interval:    1,
		Order:       "ordered",
		TotalImages: 2,
		StartIndex:  0,
	})
	ts := sched.(*timerScheduler)
	ts.interval = 25 * time.Millisecond

	finished := make(chan struct{})
	sched.Start(func(_ int) bool {
		_ = sched.NextChangeAt()
		close(finished)
		return true
	})
	defer sched.Stop()

	select {
	case <-finished:
	case <-time.After(400 * time.Millisecond):
		t.Fatal("deadlock: tick callback must not hold scheduler mutex (onTick calls NextChangeAt)")
	}
}

func TestTimerSchedulerAfterManualNavigationResetsDeadline(t *testing.T) {
	sched := NewScheduler(SchedulerConfig{
		Type:        "timer",
		Interval:    60,
		Order:       "ordered",
		TotalImages: 3,
		StartIndex:  0,
	})
	ts := sched.(*timerScheduler)
	ts.interval = 400 * time.Millisecond

	sched.Start(func(int) bool { return true })
	defer sched.Stop()

	n1 := sched.NextChangeAt()
	require.NotNil(t, n1)
	before := time.Now()
	sched.AfterManualNavigation(2)
	n2 := sched.NextChangeAt()
	require.NotNil(t, n2)
	assert.GreaterOrEqual(t, n2.Sub(before), 300*time.Millisecond,
		"manual navigation should restart the full interval from now")
}

func TestTimerSchedulerOrderedIndices(t *testing.T) {
	indices := make([]int, 0, 5)
	done := make(chan struct{})

	sched := NewScheduler(SchedulerConfig{
		Type:        "timer",
		Interval:    1,
		Order:       "ordered",
		TotalImages: 3,
		StartIndex:  0,
	})

	ts := sched.(*timerScheduler)
	ts.interval = 10 * time.Millisecond

	sched.Start(func(index int) bool {
		indices = append(indices, index)
		if len(indices) >= 3 {
			close(done)
		}
		return true
	})
	defer sched.Stop()

	select {
	case <-done:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("did not get 3 ticks in time")
	}

	assert.Equal(t, []int{1, 2, 0}, indices, "ordered scheduler should cycle through indices sequentially")
}

func TestTimerSchedulerDoesNotAdvanceWhenApplyFails(t *testing.T) {
	var mu sync.Mutex
	var seen []int
	done := make(chan struct{})
	var notifyOnce sync.Once

	sched := NewScheduler(SchedulerConfig{
		Type:        "timer",
		Interval:    1,
		Order:       "ordered",
		TotalImages: 2,
		StartIndex:  0,
	})

	ts := sched.(*timerScheduler)
	ts.interval = 15 * time.Millisecond

	sched.Start(func(idx int) bool {
		mu.Lock()
		seen = append(seen, idx)
		failFirst := len(seen) == 1
		mu.Unlock()
		if failFirst {
			return false
		}
		notifyOnce.Do(func() { close(done) })
		return true
	})
	defer sched.Stop()

	select {
	case <-done:
	case <-time.After(400 * time.Millisecond):
		t.Fatal("timeout waiting for successful tick after failed apply")
	}

	mu.Lock()
	defer mu.Unlock()
	require.GreaterOrEqual(t, len(seen), 2)
	assert.Equal(t, 1, seen[0])
	assert.Equal(t, 1, seen[1], "failed timer tick must retry same playlist index")
}

func TestTimerReconcileSchedulerConfig_ordered(t *testing.T) {
	start, idx, cur := timerReconcileSchedulerConfig("ordered", 5, 3)
	assert.Equal(t, 3, start)
	assert.Nil(t, idx)
	assert.Equal(t, 0, cur)
}

func TestTimerReconcileSchedulerConfig_ordered_clampsRow(t *testing.T) {
	start, idx, cur := timerReconcileSchedulerConfig("ordered", 3, 99)
	assert.Equal(t, 2, start)
	assert.Nil(t, idx)
	assert.Equal(t, 0, cur)
}

func TestTimerReconcileSchedulerConfig_random_alignsRow(t *testing.T) {
	n := 12
	row := 7
	for range 80 {
		_, indices, cur := timerReconcileSchedulerConfig("random", n, row)
		require.Len(t, indices, n)
		seen := make(map[int]bool, n)
		for _, v := range indices {
			assert.False(t, seen[v], "permutation duplicate %d", v)
			seen[v] = true
		}
		assert.Equal(t, row, indices[cur], "cursor must point at current playlist row")
	}
}

func TestTimerReconcileSchedulerConfig_empty(t *testing.T) {
	start, idx, cur := timerReconcileSchedulerConfig("ordered", 0, 0)
	assert.Equal(t, 0, start)
	assert.Nil(t, idx)
	assert.Equal(t, 0, cur)
}
