# Wallpaper State Consistency Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the class of bugs where the database records a wallpaper that is not actually on screen, and where playlist scheduler state goes stale across fresh starts and system suspend.

**Architecture:** Four independent Go fixes in `waypaper-engine/daemon` (scheduler timing, monitor-state atomicity, backend-switch atomicity, restore serialization), two frontend fixes in `waypaper-engine` (SSE resync, power-resume hook), and one cross-repo protocol change making `wal-qt`'s `POST /wallpaper/load` respond only after the renderer confirms the load actually landed.

**Tech Stack:** Go 1.26 (daemon), React 19 + Zustand + TypeScript (renderer), Electron (main process), Qt 6 / C++20 + QWebEngine (wal-qt host), TypeScript + Vite (wal-qt renderer). Tests: `testify` (Go), `vitest` (TS), `ctest` (wal-qt).

## Global Constraints

- Work on branch `fix/state-consistency` off `main` in `waypaper-engine`, and `fix/truthful-load-ack` off `main` in `wal-qt`. Never commit to `main`.
- Go toolchain 1.26, Node 24, pnpm 11 — use `mise` from `waypaper-engine/`.
- Formatters are authoritative: **oxfmt**, **oxlint**, **gofmt**. Never hand-format.
- **No compatibility shims, no legacy aliases.** This project is rewrite-friendly; breaking the `wal-qt` HTTP contract is explicitly acceptable. Fix forward.
- Every task is TDD: write the failing test, run it, watch it fail for the right reason, then implement.
- Every task ends with the full suite for its area green before commit. A task that leaves any pre-existing test broken is not done.
- Conventional commit messages (`fix:`, `feat:`, `test:`).
- Do not "improve" adjacent code. Every changed line traces to a task step.

## Verification Commands

Run from `waypaper-engine/`:

| Command | Scope |
|---|---|
| `pnpm run test:daemon:unit` | Go unit tests (`-short`) |
| `pnpm run test:daemon` | all Go daemon tests |
| `pnpm run test:daemon:race` | Go race detector — **required** for Tasks 1–8 |
| `pnpm test` | renderer vitest |
| `pnpm run format:check && pnpm run lint:check && pnpm run gofmt:check` | formatters |
| `pnpm run ci:check` | everything |

Run from `wal-qt/`:

| Command | Scope |
|---|---|
| `make build` | renderer vite build + CMake |
| `make test` | ctest |
| `make check` | renderer lint + format + typecheck + vitest |

---

## Task 1: Scheduler publishes `NextChangeAt` synchronously

**Root cause:** `Manager.startPlaylist` reads `sched.NextChangeAt()` on the calling goroutine immediately after `sched.Start()` (`manager.go:172` then `:179`). `timerScheduler.Start` sets `nextChange` synchronously, but `timeOfDayScheduler.Start` and `dayOfWeekScheduler.Start` only spawn a goroutine — so the read returns `nil`. The stored `ActivePlaylistInstance.NextChangeAt` is `nil`, which (a) makes `TrackProgress` render no progress bar (`src/components/PlaylistController.tsx:43-50`) and (b) makes `missedEventChecker` bail at `manager.go:945-947` so suspend recovery never runs either.

**Files:**
- Modify: `daemon/internal/playlist/scheduler.go` (`timeOfDayScheduler.Start` ~`:382-388`, `dayOfWeekScheduler.Start` ~`:512-529`)
- Test: `daemon/internal/playlist/scheduler_test.go`

**Interfaces:**
- Consumes: existing `Scheduler` interface, `SchedulerConfig`, `TimeSlot`.
- Produces: no signature changes. `Scheduler.NextChangeAt()` gains the guarantee that it returns non-nil immediately after `Start()` for `timer`, `time_of_day`, and `day_of_week`. `manualScheduler` still returns `nil` — that is correct and intended.

- [ ] **Step 1: Write the failing test**

Append to `daemon/internal/playlist/scheduler_test.go`:

```go
// Regression: startPlaylist reads NextChangeAt() synchronously right after Start().
// time_of_day and day_of_week used to populate it inside their goroutine, so the
// active playlist instance was stored with next_change_at=nil — no progress bar in
// the UI and missedEventChecker permanently short-circuited.
func TestSchedulerPublishesNextChangeAtSynchronously(t *testing.T) {
	tests := []struct {
		name string
		cfg  SchedulerConfig
	}{
		{
			name: "timer",
			cfg:  SchedulerConfig{Type: "timer", Interval: 300, Order: "ordered", TotalImages: 3},
		},
		{
			name: "time_of_day",
			cfg: SchedulerConfig{Type: "time_of_day", TotalImages: 3, TimeSlots: []TimeSlot{
				{Minutes: 0, ImageIndex: 0},
				{Minutes: 600, ImageIndex: 1},
				{Minutes: 1200, ImageIndex: 2},
			}},
		},
		{
			name: "day_of_week",
			cfg:  SchedulerConfig{Type: "day_of_week", TotalImages: 7},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := NewScheduler(tt.cfg)
			t.Cleanup(s.Stop)

			s.Start(func(int) bool { return true })

			next := s.NextChangeAt()
			require.NotNil(t, next, "NextChangeAt must be populated before Start() returns")
			assert.True(t, next.After(time.Now().Add(-time.Second)),
				"NextChangeAt should be at or after now, got %v", next)
		})
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd daemon && go test ./internal/playlist/ -run TestSchedulerPublishesNextChangeAtSynchronously -v`

Expected: FAIL on subtests `time_of_day` and `day_of_week` with "NextChangeAt must be populated before Start() returns". Subtest `timer` PASSES — that path is already correct and must stay correct.

- [ ] **Step 3: Implement — `timeOfDayScheduler.Start`**

Replace the body of `timeOfDayScheduler.Start` in `daemon/internal/playlist/scheduler.go`:

```go
func (s *timeOfDayScheduler) Start(callback func(int) bool) {
	s.mu.Lock()
	s.callback = callback
	// Publish the first deadline before returning: Manager.startPlaylist reads
	// NextChangeAt() synchronously to build ActivePlaylistInstance.
	if _, dur := s.nextTransition(); dur > 0 {
		next := time.Now().Add(dur)
		s.nextChange = &next
	}
	s.mu.Unlock()

	go s.loop()
}
```

Note: `nextTransition` reads `s.slots`, which is only written at construction, so calling it under `s.mu` is safe and introduces no lock ordering issue.

- [ ] **Step 4: Implement — `dayOfWeekScheduler.Start`**

Replace the body of `dayOfWeekScheduler.Start`:

```go
func (s *dayOfWeekScheduler) Start(callback func(int) bool) {
	s.mu.Lock()
	s.callback = callback
	// Publish tomorrow's rollover before returning — see timeOfDayScheduler.Start.
	now := time.Now()
	tomorrow := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
	s.nextChange = &tomorrow
	s.mu.Unlock()

	// Fire immediately for today's weekday.
	go func() {
		weekday := int(time.Now().Weekday())
		idx := min(weekday, s.totalImages-1)
		s.mu.Lock()
		cb := s.callback
		s.mu.Unlock()
		if cb != nil {
			_ = cb(idx)
		}
		s.scheduleNext()
	}()
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd daemon && go test ./internal/playlist/ -v`
Expected: PASS, including all pre-existing tests.

- [ ] **Step 6: Run the race detector**

Run: `cd daemon && go test -race ./internal/playlist/`
Expected: PASS, no `DATA RACE` reports.

- [ ] **Step 7: Commit**

```bash
git add daemon/internal/playlist/scheduler.go daemon/internal/playlist/scheduler_test.go
git commit -m "fix(playlist): publish NextChangeAt before Start returns

time_of_day and day_of_week set nextChange inside their goroutine, so
startPlaylist's synchronous read stored next_change_at=nil. That hid the
UI progress bar and made missedEventChecker short-circuit forever."
```

---

## Task 2: Missed-event recovery for `timer` playlists

**Root cause:** `missedEventChecker` is only started for `time_of_day` and `day_of_week` (`manager.go:153-155`). Go timers use `CLOCK_MONOTONIC`, which does not advance across suspend on Linux, so a `timer` playlist suspended for hours resumes and still waits out the remainder of its *awake-time* interval while the persisted wall-clock `NextChangeAt` sits in the past.

**Files:**
- Modify: `daemon/internal/playlist/manager.go` (`startPlaylist` ~`:153-155`, `missedEventChecker` ~`:929-1015`)
- Test: `daemon/internal/playlist/scheduler_test.go`

**Interfaces:**
- Consumes: `Manager.applyImage`, `Scheduler.AfterManualNavigation(int)`, `store.ActivePlaylistInstance.NextChangeAt`.
- Produces: `missedEventChecker` now handles `pl.Configuration.Type == "timer"` by advancing one slide from the instance's current row and re-anchoring the scheduler.

- [ ] **Step 1: Write the failing test**

Append to `daemon/internal/playlist/scheduler_test.go`:

```go
// Regression: timer playlists had no missed-event recovery. After a system
// suspend the monotonic timer has not elapsed but the persisted wall-clock
// NextChangeAt is far in the past, leaving the rotation stalled.
func TestMissedEventRecoveryCoversTimerPlaylists(t *testing.T) {
	assert.True(t, playlistTypeNeedsMissedEventChecker("timer"))
	assert.True(t, playlistTypeNeedsMissedEventChecker("time_of_day"))
	assert.True(t, playlistTypeNeedsMissedEventChecker("day_of_week"))
	assert.False(t, playlistTypeNeedsMissedEventChecker("manual"))
	assert.False(t, playlistTypeNeedsMissedEventChecker(""))
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd daemon && go test ./internal/playlist/ -run TestMissedEventRecoveryCoversTimerPlaylists -v`
Expected: FAIL to compile — `undefined: playlistTypeNeedsMissedEventChecker`.

- [ ] **Step 3: Add the predicate and use it in `startPlaylist`**

In `daemon/internal/playlist/manager.go`, add near `computeInitialState`:

```go
// playlistTypeNeedsMissedEventChecker reports whether a playlist type needs the
// wall-clock watchdog. Every self-advancing type does: Go timers run on
// CLOCK_MONOTONIC, which does not advance across system suspend, so all three
// can silently miss their transition after a resume. Manual playlists never
// self-advance and are excluded.
func playlistTypeNeedsMissedEventChecker(playlistType string) bool {
	switch playlistType {
	case "timer", "time_of_day", "day_of_week":
		return true
	default:
		return false
	}
}
```

Replace the guard at `manager.go:153-155`:

```go
	if playlistTypeNeedsMissedEventChecker(pl.Configuration.Type) {
		go m.missedEventChecker(playCtx, pl.ID, monitors, targetEff)
	}
```

- [ ] **Step 4: Teach `missedEventChecker` how to advance a timer playlist**

In `missedEventChecker`, replace the index-selection switch (currently `manager.go:968-975`) with:

```go
				var newIdx int
				switch pl.Configuration.Type {
				case "time_of_day":
					newIdx = findClosestTimeSlot(buildTimeSlots(pl))
				case "day_of_week":
					weekday := int(now.Weekday())
					newIdx = min(weekday, len(pl.Images)-1)
				case "timer":
					// A timer has no wall-clock anchor to recompute from; advance one
					// slide from wherever the instance currently sits, same as a tick.
					newIdx = advancePlaylistRow(inst, pl, 1)
				default:
					continue
				}
```

Then, immediately after the existing `effectiveIdx := result.AppliedIndex` line inside `missedEventChecker`, insert the scheduler re-anchor so the timer's shuffle cursor and interval restart from now:

```go
				if pl.Configuration.Type == "timer" {
					m.mu.RLock()
					run, runOK := m.runs[playlistID]
					m.mu.RUnlock()
					if runOK {
						run.sched.AfterManualNavigation(effectiveIdx)
					}
				}
```

This must come **before** the existing `m.mu.RLock()` block that reads `nextChange`, so the refreshed deadline is the one persisted.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd daemon && go test ./internal/playlist/ -v`
Expected: PASS.

- [ ] **Step 6: Run the race detector**

Run: `cd daemon && go test -race ./internal/playlist/`
Expected: PASS. Pay attention: `AfterManualNavigation` blocks on the runLoop select, so a deadlock here shows up as a test timeout, not a race report.

- [ ] **Step 7: Commit**

```bash
git add daemon/internal/playlist/manager.go daemon/internal/playlist/scheduler_test.go
git commit -m "fix(playlist): run missed-event recovery for timer playlists

Go timers use CLOCK_MONOTONIC, which does not advance across suspend, so
timer playlists stalled after resume with a wall-clock NextChangeAt in
the past and no watchdog to notice."
```

---

## Task 3: `Resume()` must not spawn a duplicate loop or race on `s.timer`

**Root cause:** `timeOfDayScheduler.Resume` (`scheduler.go:472-478`) and `dayOfWeekScheduler.Resume` (`:585-591`) each do `go s.loop()` / `go s.scheduleNext()` while the original goroutine is still parked. `Pause()` calls `timer.Stop()`, which does not wake the `select`, so the old goroutine stays blocked on the old timer channel forever — a leak — while the new loop overwrites `s.timer` under the mutex. Meanwhile the old goroutine reads `s.timer` **without** the mutex at `:405` and `:546`, which is a genuine data race.

**Files:**
- Modify: `daemon/internal/playlist/scheduler.go` (`timeOfDayScheduler` and `dayOfWeekScheduler`: struct fields, `loop`, `scheduleNext`, `Pause`, `Resume`, `Stop`)
- Test: `daemon/internal/playlist/scheduler_test.go`

**Interfaces:**
- Consumes: existing `Scheduler` interface.
- Produces: no signature changes. Both schedulers gain a `resumeCh chan struct{}` (buffered, capacity 1) mirroring `timerScheduler`. `Pause`/`Resume` become loop-state transitions rather than goroutine lifecycle operations. Exactly one loop goroutine exists per scheduler for its whole life.

- [ ] **Step 1: Write the failing test**

Append to `daemon/internal/playlist/scheduler_test.go`:

```go
// Regression: Resume() used to spawn a second loop goroutine while the original
// stayed parked on a stopped timer, leaking one goroutine per pause/resume cycle
// and racing on s.timer between the parked reader and the new writer.
func TestPauseResumeDoesNotLeakSchedulerGoroutines(t *testing.T) {
	tests := []struct {
		name string
		cfg  SchedulerConfig
	}{
		{
			name: "time_of_day",
			cfg: SchedulerConfig{Type: "time_of_day", TotalImages: 2, TimeSlots: []TimeSlot{
				{Minutes: 0, ImageIndex: 0},
				{Minutes: 720, ImageIndex: 1},
			}},
		},
		{
			name: "day_of_week",
			cfg:  SchedulerConfig{Type: "day_of_week", TotalImages: 7},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			before := runtime.NumGoroutine()

			s := NewScheduler(tt.cfg)
			s.Start(func(int) bool { return true })

			for range 20 {
				s.Pause()
				s.Resume()
			}
			time.Sleep(100 * time.Millisecond)

			during := runtime.NumGoroutine()
			assert.LessOrEqual(t, during-before, 4,
				"20 pause/resume cycles leaked %d goroutines", during-before)

			s.Stop()
			// Stop must drain every goroutine the scheduler owns.
			deadline := time.Now().Add(2 * time.Second)
			for time.Now().Before(deadline) {
				if runtime.NumGoroutine() <= before+1 {
					return
				}
				time.Sleep(20 * time.Millisecond)
			}
			assert.LessOrEqual(t, runtime.NumGoroutine()-before, 1,
				"scheduler goroutines still running after Stop()")
		})
	}
}
```

Add `"runtime"` to that file's imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd daemon && go test -race ./internal/playlist/ -run TestPauseResumeDoesNotLeakSchedulerGoroutines -v`
Expected: FAIL — leaked goroutine count well above 4, and very likely a `DATA RACE` report on `s.timer`.

- [ ] **Step 3: Implement — `timeOfDayScheduler`**

Add `resumeCh chan struct{}` to the struct and initialise it in `newTimeOfDayScheduler`:

```go
type timeOfDayScheduler struct {
	mu         sync.Mutex
	slots      []TimeSlot
	callback   func(int) bool
	timer      *time.Timer
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
	}
}
```

Rewrite `loop` so the single goroutine owns its timer as a local, never a shared field, and parks on `resumeCh` while paused:

```go
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
			// Spurious wake (Resume with no matching Pause); recompute the deadline.
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
```

Rewrite `Pause`, `Resume`, and `Stop` — note `s.timer` is gone entirely:

```go
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

func (s *timeOfDayScheduler) Stop() {
	s.stopOnce.Do(func() {
		close(s.stopCh)
		s.mu.Lock()
		s.nextChange = nil
		s.mu.Unlock()
	})
}
```

Remove the now-unused `timer` field from the struct.

- [ ] **Step 4: Implement — `dayOfWeekScheduler`**

Apply the identical shape. Struct gains `resumeCh chan struct{}` and loses `timer`:

```go
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
	}
}
```

```go
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
```

`Start` keeps the Task 1 shape — it still spawns exactly one goroutine which fires today's slide then calls `scheduleNext()`.

- [ ] **Step 5: Run the full playlist suite with race detection**

Run: `cd daemon && go test -race ./internal/playlist/ -v`
Expected: PASS, no `DATA RACE`. Task 1's test must still pass — `Resume` now also republishes `nextChange`.

- [ ] **Step 6: Commit**

```bash
git add daemon/internal/playlist/scheduler.go daemon/internal/playlist/scheduler_test.go
git commit -m "fix(playlist): stop leaking a scheduler goroutine on every resume

Resume() spawned a second loop while the original stayed parked on a
stopped timer, and the parked goroutine read s.timer without the mutex.
Both schedulers now own one goroutine for life and park on resumeCh."
```

---

## Task 4: A restored *paused* `day_of_week` playlist must not apply a wallpaper

**Root cause:** `startPlaylist` calls `sched.Start(...)` at `manager.go:172` but only calls `run.sched.Pause()` at `:199`. `dayOfWeekScheduler.Start` fires its callback immediately from a goroutine, so a playlist restored in the paused state races that `Pause()` and applies anyway. Worse, on the `fromPersisted` path this collides with the concurrent `wallpaper.Restore` — exactly the collision the comment at `manager.go:167-171` was written to avoid.

**Files:**
- Modify: `daemon/internal/playlist/scheduler.go` (`SchedulerConfig`, `newTimerScheduler`, `newTimeOfDayScheduler`, `newDayOfWeekScheduler`)
- Modify: `daemon/internal/playlist/manager.go` (`startPlaylist`)
- Test: `daemon/internal/playlist/scheduler_test.go`

**Interfaces:**
- Consumes: `SchedulerConfig` from Tasks 1–3.
- Produces: `SchedulerConfig` gains `StartPaused bool`. When true the scheduler is constructed already paused, so `Start()` performs no initial callback and publishes `NextChangeAt() == nil`. `Manager.startPlaylist` sets it from `resumePaused` and drops the after-the-fact `run.sched.Pause()` call.

- [ ] **Step 1: Write the failing test**

Append to `daemon/internal/playlist/scheduler_test.go`:

```go
// Regression: dayOfWeekScheduler.Start fired its callback from a goroutine before
// startPlaylist could call Pause(), so a playlist restored in the paused state
// applied a wallpaper anyway — racing the concurrent wallpaper.Restore.
func TestStartPausedSuppressesInitialCallback(t *testing.T) {
	var calls atomic.Int32

	s := NewScheduler(SchedulerConfig{
		Type:        "day_of_week",
		TotalImages: 7,
		StartPaused: true,
	})
	t.Cleanup(s.Stop)

	s.Start(func(int) bool {
		calls.Add(1)
		return true
	})

	time.Sleep(150 * time.Millisecond)

	assert.Equal(t, int32(0), calls.Load(),
		"a scheduler started paused must not fire its initial callback")
	assert.Nil(t, s.NextChangeAt(),
		"a paused scheduler must not advertise a next change time")
}

// The unpaused path must keep firing immediately for today's weekday.
func TestDayOfWeekFiresImmediatelyWhenNotPaused(t *testing.T) {
	var calls atomic.Int32

	s := NewScheduler(SchedulerConfig{Type: "day_of_week", TotalImages: 7})
	t.Cleanup(s.Stop)

	s.Start(func(int) bool {
		calls.Add(1)
		return true
	})

	require.Eventually(t, func() bool { return calls.Load() == 1 },
		2*time.Second, 20*time.Millisecond,
		"day_of_week must apply today's slide on start")
	assert.NotNil(t, s.NextChangeAt())
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd daemon && go test ./internal/playlist/ -run 'TestStartPaused|TestDayOfWeekFires' -v`
Expected: FAIL to compile — `unknown field StartPaused in struct literal`.

- [ ] **Step 3: Add `StartPaused` to `SchedulerConfig`**

In `daemon/internal/playlist/scheduler.go`, add to `SchedulerConfig`:

```go
	// StartPaused constructs the scheduler already paused. Set when restoring a
	// playlist that was paused at shutdown, so Start() performs no initial
	// callback — pausing after Start() races the day_of_week immediate fire.
	StartPaused bool
```

- [ ] **Step 4: Honour it in all three constructors**

In `newTimerScheduler`, before the `return s`:

```go
	s.paused = cfg.StartPaused
```

In `newTimeOfDayScheduler`:

```go
func newTimeOfDayScheduler(cfg SchedulerConfig) *timeOfDayScheduler {
	return &timeOfDayScheduler{
		slots:    cfg.TimeSlots,
		stopCh:   make(chan struct{}),
		resumeCh: make(chan struct{}, 1),
		paused:   cfg.StartPaused,
	}
}
```

In `newDayOfWeekScheduler`:

```go
func newDayOfWeekScheduler(cfg SchedulerConfig) *dayOfWeekScheduler {
	return &dayOfWeekScheduler{
		totalImages: cfg.TotalImages,
		stopCh:      make(chan struct{}),
		resumeCh:    make(chan struct{}, 1),
		paused:      cfg.StartPaused,
	}
}
```

- [ ] **Step 5: Make each `Start` respect the paused flag**

`timerScheduler.Start` — do not publish a deadline while paused:

```go
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
```

`timeOfDayScheduler.Start` — guard the Task 1 publish:

```go
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
```

`dayOfWeekScheduler.Start` — guard both the publish and the immediate fire:

```go
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
```

- [ ] **Step 6: Wire it through `startPlaylist`**

In `daemon/internal/playlist/manager.go`, move the `resumePaused` computation **above** the `NewScheduler` call (it currently sits at `:177`, after `sched.Start`). The block from `timeSlots, startIdx, tIdx, tCur := m.playlistStartIndices(pl, opts)` through `sched := NewScheduler(...)` becomes:

```go
	timeSlots, startIdx, tIdx, tCur := m.playlistStartIndices(pl, opts)
	applyRow := startIdx
	if len(tIdx) > 0 && tCur >= 0 && tCur < len(tIdx) {
		applyRow = tIdx[tCur]
	}

	resumePaused := opts.fromPersisted && pl.Playback != nil && pl.Playback.Paused

	sched := NewScheduler(SchedulerConfig{
		Type:         pl.Configuration.Type,
		Interval:     pl.Configuration.Interval,
		Order:        pl.Configuration.Order,
		TotalImages:  len(pl.Images),
		StartIndex:   startIdx,
		TimeSlots:    timeSlots,
		TimerIndices: tIdx,
		TimerCursor:  tCur,
		StartPaused:  resumePaused,
	})
```

Delete the now-duplicate `resumePaused := ...` line further down, and delete the trailing:

```go
	if resumePaused {
		run.sched.Pause()
	}
```

Keep the existing `nextAt := sched.NextChangeAt()` / `if resumePaused { nextAt = nil }` lines — they remain correct and now agree with the scheduler's own state.

- [ ] **Step 7: Run the full playlist suite with race detection**

Run: `cd daemon && go test -race ./internal/playlist/ -v`
Expected: PASS, including `restore_test.go` and `manual_advance_test.go`.

- [ ] **Step 8: Commit**

```bash
git add daemon/internal/playlist/scheduler.go daemon/internal/playlist/manager.go daemon/internal/playlist/scheduler_test.go
git commit -m "fix(playlist): construct restored-paused schedulers already paused

startPlaylist called Pause() after Start(), which raced the day_of_week
immediate fire and applied a wallpaper for a paused playlist — colliding
with the concurrent wallpaper.Restore on the fromPersisted path."
```

---

## Task 5: Atomic monitor-state writes and per-monitor snapshot dedupe

**Root cause:** `monitorStateStore.Set` is a non-atomic delete-then-insert (`monitor_state_store_impl.go:51-71`) and the `monitor_name` index created at `db_impl.go:63` is not unique. Two concurrent `Set` calls for the same monitor can interleave as delete/delete/insert/insert, leaving **two rows for one monitor**; `BuildSnapshot` groups by `(image_id, mode)` and never dedupes by monitor name (`snapshot.go:98-111`), so restore then emits two `Output`s for the same monitor and the winner is arbitrary. A crash between the delete and the insert loses that monitor's state entirely.

**Files:**
- Modify: `daemon/internal/store/monitor_state_store_impl.go`
- Modify: `daemon/internal/wallpaper/snapshot.go` (`BuildSnapshot`)
- Test: `daemon/internal/store/store_test.go`
- Test: `daemon/internal/wallpaper/snapshot_test.go`

**Interfaces:**
- Consumes: `store.MonitorState`, `store.MonitorStateStore`, `backend.Snapshot`, `backend.Output`.
- Produces: `monitorStateStore.Set` becomes an update-in-place when a row exists, insert otherwise, guarded by a store-level mutex so concurrent writers cannot interleave. `BuildSnapshot` emits **at most one `Output` per monitor name**; when duplicate rows exist the row with the newest `SetAt` wins (tie-break: the later row in input order).

- [ ] **Step 1: Write the failing store test**

Append to `daemon/internal/store/store_test.go`:

```go
// Regression: Set was a non-atomic delete-then-insert with no unique index, so
// concurrent writers for the same monitor could leave two rows behind — which
// made restore emit two Outputs for one monitor and pick arbitrarily.
func TestMonitorStateStore_ConcurrentSetKeepsExactlyOneRow(t *testing.T) {
	db := newTestDB(t)
	store := db.MonitorStateStore()
	ctx := context.Background()

	var wg sync.WaitGroup
	for i := range 40 {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			_ = store.Set(ctx, MonitorState{
				MonitorName: "DP-1",
				ImageID:     n + 1,
				ImageName:   "img",
				ImagePath:   "/tmp/img.png",
				Mode:        "individual",
				Backend:     "test",
				SetAt:       time.Now(),
			})
		}(i)
	}
	wg.Wait()

	all, err := store.GetAll(ctx)
	require.NoError(t, err)

	count := 0
	for _, s := range all {
		if s.MonitorName == "DP-1" {
			count++
		}
	}
	assert.Equal(t, 1, count, "expected exactly one row for DP-1, got %d", count)
}
```

Reuse whatever DB fixture `store_test.go` already uses; if the helper is named differently from `newTestDB`, use the existing one rather than adding a duplicate.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd daemon && go test -race ./internal/store/ -run TestMonitorStateStore_ConcurrentSetKeepsExactlyOneRow -v`
Expected: FAIL — more than one row for `DP-1`.

- [ ] **Step 3: Implement the atomic upsert**

Rewrite `daemon/internal/store/monitor_state_store_impl.go`. Add a mutex to the struct and replace `Set`:

```go
// monitorStateStore is the CloverDB-backed implementation of MonitorStateStore.
// It stores one document per monitor, using monitor_name as the unique key.
// CloverDB has no unique index, so writes are serialised here: a delete-then-insert
// pair from two goroutines would otherwise leave two rows for one monitor.
type monitorStateStore struct {
	db *clover.DB
	mu sync.Mutex
}
```

```go
func (s *monitorStateStore) Set(_ context.Context, state MonitorState) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	fields := map[string]any{
		"monitor_name": state.MonitorName,
		"image_id":     state.ImageID,
		"image_name":   state.ImageName,
		"image_path":   state.ImagePath,
		"mode":         state.Mode,
		"backend":      state.Backend,
		"set_at":       state.SetAt,
	}

	q := query.NewQuery(CollectionMonitorState).Where(
		query.Field("monitor_name").Eq(state.MonitorName),
	)

	existing, err := s.db.FindFirst(q)
	if err != nil {
		return fmt.Errorf("monitor state store: lookup %q: %w", state.MonitorName, err)
	}

	if existing != nil {
		// Update in place — never leaves a window with zero rows for this monitor.
		if err := s.db.Update(q, fields); err != nil {
			return fmt.Errorf("monitor state store: update %q: %w", state.MonitorName, err)
		}
		return nil
	}

	doc := d.NewDocument()
	for k, v := range fields {
		doc.Set(k, v)
	}
	if _, err := s.db.InsertOne(CollectionMonitorState, doc); err != nil {
		return fmt.Errorf("monitor state store: set %q: %w", state.MonitorName, err)
	}
	return nil
}
```

Add `"sync"` to the imports. Also take `s.mu` in `Remove` so a concurrent `Set`/`Remove` pair cannot interleave.

Verify the CloverDB v2 `Update` signature in `daemon/go.sum`'s vendored API before relying on it — if it differs, use the equivalent update call and keep the "never delete before insert" property, which is the actual requirement.

- [ ] **Step 4: Run the store test**

Run: `cd daemon && go test -race ./internal/store/ -v`
Expected: PASS.

- [ ] **Step 5: Write the failing snapshot test**

Append to `daemon/internal/wallpaper/snapshot_test.go`:

```go
// Regression: BuildSnapshot grouped by (image_id, mode) and never deduped by
// monitor name, so duplicate monitor_state rows produced two Outputs for one
// monitor and the backend picked arbitrarily. Newest SetAt must win.
func TestBuildSnapshot_DedupesDuplicateRowsPerMonitor(t *testing.T) {
	older := time.Now().Add(-time.Hour)
	newer := time.Now()

	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 1, Mode: "individual", SetAt: older},
		{MonitorName: "DP-1", ImageID: 2, Mode: "individual", SetAt: newer},
	}

	// Build `connected`, the image store fake, and the backend fake exactly as the
	// existing tests in this file do — images 1 and 2 must both resolve to real
	// files on disk so neither is treated as an orphan.
	snap, _, err := BuildSnapshot(
		context.Background(), states, connected, images, nil, activeBackend,
		nil, nil, nil, nil, false,
	)
	require.NoError(t, err)

	require.Len(t, snap.Outputs, 1, "one monitor must yield exactly one output")
	assert.Equal(t, "DP-1", snap.Outputs[0].Monitor.Name)

	img, ok := snap.Outputs[0].Content.(backend.StaticImage)
	require.True(t, ok)
	assert.Contains(t, img.Path(), "2", "the newest row (image 2) must win")
}
```

Adapt `connected`, `images`, and `activeBackend` to this file's existing fixtures — do not invent new helpers.

- [ ] **Step 6: Run test to verify it fails**

Run: `cd daemon && go test ./internal/wallpaper/ -run TestBuildSnapshot_DedupesDuplicateRowsPerMonitor -v`
Expected: FAIL — `snap.Outputs` has length 2.

- [ ] **Step 7: Dedupe input rows in `BuildSnapshot`**

At the very top of `BuildSnapshot` in `daemon/internal/wallpaper/snapshot.go`, before the Step 1 grouping loop, collapse duplicates:

```go
	// Defensive: monitor_state should hold one row per monitor, but a historical
	// non-atomic upsert could leave duplicates. Keep the newest row per monitor so
	// a single monitor never receives two conflicting Outputs.
	states = dedupeStatesByMonitor(states)
```

Add below `BuildSnapshot`:

```go
// dedupeStatesByMonitor keeps one row per monitor name — the one with the newest
// SetAt, tie-broken by the later position in the input slice. Input order of the
// surviving rows is preserved so Snapshot output ordering stays deterministic.
func dedupeStatesByMonitor(states []store.MonitorState) []store.MonitorState {
	if len(states) < 2 {
		return states
	}
	bestIdx := make(map[string]int, len(states))
	for i, s := range states {
		prev, seen := bestIdx[s.MonitorName]
		if !seen || !states[i].SetAt.Before(states[prev].SetAt) {
			bestIdx[s.MonitorName] = i
		}
	}
	keep := make(map[int]struct{}, len(bestIdx))
	for _, i := range bestIdx {
		keep[i] = struct{}{}
	}
	out := make([]store.MonitorState, 0, len(keep))
	for i, s := range states {
		if _, ok := keep[i]; ok {
			out = append(out, s)
		}
	}
	return out
}
```

- [ ] **Step 8: Run the full wallpaper + store suites**

Run: `cd daemon && go test -race ./internal/wallpaper/ ./internal/store/ -v`
Expected: PASS, including all pre-existing snapshot tests.

- [ ] **Step 9: Commit**

```bash
git add daemon/internal/store/monitor_state_store_impl.go daemon/internal/store/store_test.go daemon/internal/wallpaper/snapshot.go daemon/internal/wallpaper/snapshot_test.go
git commit -m "fix(store): make monitor state upsert atomic and dedupe on restore

Set was a delete-then-insert with no unique index, so concurrent writers
could leave two rows per monitor and a crash between the two statements
lost the row entirely. BuildSnapshot now keeps the newest row per monitor."
```

---

## Task 6: Serialise backend switching and stop re-reading the registry

**Root cause:** `SwitchActiveBackend` (`backend/switch.go:28-63`) performs `Shutdown → SetActive → Initialize` with no lock — only the individual registry methods are guarded. Concurrent callers (auto-mode playlist ticks at `manager.go:810`, `EnsureBackendForMedia` at `wallpaperhandler/wallpaper.go:106,196`, `Controller.ActivateBackend`) can interleave so one goroutine initialises another's backend. Line 47 compounds it by re-reading `reg.Active()` instead of using what it just set, and `Manager.doApply` re-reads `m.registry.Active()` again at `manager.go:835` — a third possible value. Net effect: an apply can succeed against a backend that was already shut down, and the DB records it.

**Files:**
- Modify: `daemon/internal/backend/switch.go`
- Modify: `daemon/internal/playlist/manager.go` (`applyImageAuto`, `doApply`)
- Test: `daemon/internal/backend/switch_test.go` (create)

**Interfaces:**
- Consumes: `backend.Registry`, `backend.Backend`, `backend.ConfigPersister`, `backend.SwitchOpts`.
- Produces: **`SwitchActiveBackend` signature changes** to `func SwitchActiveBackend(ctx context.Context, reg Registry, name string, cfg ConfigPersister, opts SwitchOpts) (Backend, error)`. It returns the backend it actually activated. `Manager.doApply` gains a `b backend.Backend` parameter and uses it instead of `m.registry.Active()`. All existing call sites must be updated: `control/controller.go:194,216`, `playlist/manager.go:810`, and wherever `backend.EnsureBackendForMedia` calls it in `backend/select.go`.

- [ ] **Step 1: Write the failing test**

Create `daemon/internal/backend/switch_test.go`:

```go
package backend

import (
	"context"
	"encoding/json"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// trackingBackend records how many times it is concurrently "live" between
// Initialize and Shutdown, so an interleaved switch shows up as >1.
type trackingBackend struct {
	name    string
	live    atomic.Int32
	maxLive atomic.Int32
}

func (b *trackingBackend) Name() string      { return b.name }
func (b *trackingBackend) IsAvailable() bool { return true }
func (b *trackingBackend) Capabilities() Capabilities {
	return Capabilities{ContentKinds: []ContentKind{KindStaticImage}}
}
func (b *trackingBackend) Initialize(_ context.Context) error {
	n := b.live.Add(1)
	for {
		m := b.maxLive.Load()
		if n <= m || b.maxLive.CompareAndSwap(m, n) {
			break
		}
	}
	return nil
}
func (b *trackingBackend) Shutdown(_ context.Context) error   { b.live.Add(-1); return nil }
func (b *trackingBackend) RegisterDefaults(_ *viper.Viper)    {}
func (b *trackingBackend) ValidateConfig(_ json.RawMessage) error { return nil }
func (b *trackingBackend) Apply(_ context.Context, _ Snapshot) error { return nil }

type noopPersister struct{}

func (noopPersister) SetActiveBackendType(string) error { return nil }

// Regression: Shutdown -> SetActive -> Initialize was unguarded, so two callers
// could interleave and one would initialize the other's backend while the
// registry pointed at a third. Auto-mode ticks race manual sets through here.
func TestSwitchActiveBackend_ConcurrentSwitchesStayConsistent(t *testing.T) {
	reg := NewRegistry()
	a := &trackingBackend{name: "alpha"}
	b := &trackingBackend{name: "beta"}
	require.NoError(t, reg.Register(a))
	require.NoError(t, reg.Register(b))
	require.NoError(t, reg.SetActive("alpha"))

	var wg sync.WaitGroup
	for i := range 50 {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			target := "alpha"
			if n%2 == 0 {
				target = "beta"
			}
			got, err := SwitchActiveBackend(context.Background(), reg, target, noopPersister{}, SwitchOpts{})
			if err == nil {
				require.NotNil(t, got)
				assert.Equal(t, target, got.Name(),
					"SwitchActiveBackend must return the backend it activated")
			}
		}(i)
	}
	wg.Wait()

	assert.LessOrEqual(t, a.maxLive.Load(), int32(1), "alpha was initialized while already live")
	assert.LessOrEqual(t, b.maxLive.Load(), int32(1), "beta was initialized while already live")
	assert.True(t, reg.HasActive())
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd daemon && go test -race ./internal/backend/ -run TestSwitchActiveBackend_ConcurrentSwitchesStayConsistent -v`
Expected: FAIL to compile first (`SwitchActiveBackend` returns one value). After Step 3's signature change it should fail on the `maxLive` assertions until the mutex lands.

- [ ] **Step 3: Serialise the switch and return the activated backend**

Rewrite `daemon/internal/backend/switch.go`:

```go
// switchMu serialises the whole Shutdown -> SetActive -> Initialize transition.
// The registry's own methods are individually locked, but the transition is not
// atomic without this: two callers could otherwise interleave so that one
// initializes the other's backend while the registry points at a third.
var switchMu sync.Mutex

// SwitchActiveBackend shuts down the current backend, activates the named one,
// and initializes it. On init failure it rolls back to the previous backend.
// It returns the backend that is active on success — callers must use this value
// rather than re-reading Registry.Active(), which another switch may have moved.
//
// Callers are responsible for any post-switch work (restore wallpapers, apply
// a specific wallpaper, fire SSE events, etc.) — this function only handles
// the lifecycle transition.
func SwitchActiveBackend(ctx context.Context, reg Registry, name string, cfg ConfigPersister, opts SwitchOpts) (Backend, error) {
	switchMu.Lock()
	defer switchMu.Unlock()

	current := reg.Active()
	if current != nil && current.Name() == name {
		return current, nil
	}

	if current != nil {
		if err := current.Shutdown(ctx); err != nil {
			slog.Warn("switch backend: shutdown failed", "backend", current.Name(), "error", err)
		}
	}

	if err := reg.SetActive(name); err != nil {
		if current != nil {
			_ = rollback(ctx, reg, current.Name())
		}
		return nil, fmt.Errorf("set active %q: %w", name, err)
	}

	newBackend, ok := reg.Get(name)
	if !ok {
		return nil, fmt.Errorf("backend %q disappeared from registry after activation", name)
	}
	if err := newBackend.Initialize(ctx); err != nil {
		if current != nil {
			_ = rollback(ctx, reg, current.Name())
		}
		return nil, fmt.Errorf("initialize %q: %w", name, err)
	}

	if opts.PersistConfig && cfg != nil {
		if err := cfg.SetActiveBackendType(name); err != nil {
			slog.Warn("switch backend: persist config failed", "backend", name, "error", err)
		}
	}

	slog.Info("backend switched", "from", backendName(current), "to", name, "persisted", opts.PersistConfig)
	return newBackend, nil
}
```

Add `"sync"` to the imports. Leave `rollback` and `backendName` as they are.

- [ ] **Step 4: Update every call site**

`daemon/internal/control/controller.go` — `ActivateBackend`:

```go
	if _, err := backend.SwitchActiveBackend(ctx, c.registry, name, c.cfg, backend.SwitchOpts{
		PersistConfig: true,
	}); err != nil {
		return ActivationResult{}, err
	}
```

`ResetAllConfigToDefaults`:

```go
	if _, err := backend.SwitchActiveBackend(ctx, c.registry, want, c.cfg, backend.SwitchOpts{PersistConfig: false}); err != nil {
		slog.Warn("factory reset: could not activate configured backend", "backend", want, "error", err)
	}
```

Search for any other caller with `grep -rn "SwitchActiveBackend" daemon/ --include=*.go` and update each — including `backend/select.go` if `EnsureBackendForMedia` uses it.

- [ ] **Step 5: Thread the activated backend into `doApply`**

In `daemon/internal/playlist/manager.go`, change `applyImageAuto`'s switch call and pass the result down:

```go
	activated, err := backend.SwitchActiveBackend(ctx, m.registry, targetName, m.cfg, backend.SwitchOpts{
		PersistConfig: false,
	})
	if err != nil {
		return applyResult{AppliedIndex: -1}, fmt.Errorf("auto switch to %s: %w", targetName, err)
	}

	return m.doApply(ctx, pl, index, monitors, mode, 0, activated)
```

Change `doApply`'s signature and its use of the registry:

```go
func (m *Manager) doApply(ctx context.Context, pl *store.Playlist, index int, monitors []monitor.Monitor, mode monitor.MonitorMode, skipped int, b backend.Backend) (applyResult, error) {
```

and inside it replace `Backend: m.registry.Active(),` with `Backend: b,`.

In `applyImageFixed`, pass the backend it already resolved:

```go
	activeBackend := m.registry.Active()
	caps := activeBackend.Capabilities()
	// ... unchanged ...
	return m.doApply(ctx, pl, resolvedIdx, monitors, mode, skipped, activeBackend)
```

- [ ] **Step 6: Run the full daemon suite with race detection**

Run: `cd daemon && go test -race ./... `
Expected: PASS. Fix any compile errors from the signature change before moving on.

- [ ] **Step 7: Commit**

```bash
git add daemon/internal/backend/switch.go daemon/internal/backend/switch_test.go daemon/internal/control/controller.go daemon/internal/playlist/manager.go
git commit -m "fix(backend): serialise backend switching and return the activated backend

Shutdown -> SetActive -> Initialize was unguarded, so concurrent auto-mode
ticks and manual sets could interleave and apply to a backend that had
already been shut down while the DB recorded success."
```

---

## Task 7: `Registry.Active()` must not panic in the no-backend degraded mode

**Root cause:** `registry.Active()` panics when `activeName == ""` (`registry_impl.go:50`), but `daemon.go:144` explicitly supports starting with no backend installed and registers all routes unconditionally at `:256`. `GET /wallpaper/current` reaches `h.registry.Active().Name()` at `wallpaperhandler/wallpaper.go:277` and panics; `Recoverer` turns that into an opaque 500 instead of a clean 503.

**Files:**
- Modify: `daemon/internal/backend/registry_impl.go`
- Modify: `daemon/internal/handler/wallpaperhandler/wallpaper.go` (`GetCurrent`)
- Test: `daemon/internal/backend/registry_test.go`

**Interfaces:**
- Consumes: `backend.Registry`.
- Produces: `Registry.Active()` returns `nil` instead of panicking when no backend is active. `HasActive()` is unchanged. `GetCurrent` returns `503` with error code `no_backend` when there is no active backend. Note Task 6's `SwitchActiveBackend` already handles a nil `current`.

- [ ] **Step 1: Write the failing test**

Append to `daemon/internal/backend/registry_test.go`:

```go
// Regression: Active() panicked with no backend activated, but the daemon
// explicitly supports a degraded no-backend start and registers routes anyway,
// so GET /wallpaper/current turned a supported state into an opaque 500.
func TestRegistry_ActiveReturnsNilWhenNoBackendActivated(t *testing.T) {
	reg := NewRegistry()

	assert.False(t, reg.HasActive())
	assert.NotPanics(t, func() {
		assert.Nil(t, reg.Active())
	})
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd daemon && go test ./internal/backend/ -run TestRegistry_ActiveReturnsNilWhenNoBackendActivated -v`
Expected: FAIL with the panic "backend: Active() called but no backend has been activated".

- [ ] **Step 3: Return nil instead of panicking**

In `daemon/internal/backend/registry_impl.go`:

```go
// Active returns the active backend, or nil when none has been activated.
// The daemon supports a degraded no-backend start, so callers must nil-check.
func (r *registry) Active() Backend {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.activeName == "" {
		return nil
	}
	return r.backends[r.activeName]
}
```

- [ ] **Step 4: Guard the handler**

In `daemon/internal/handler/wallpaperhandler/wallpaper.go`, at the top of `GetCurrent` (before `h.monitorStateStore.GetAll`):

```go
	activeBackend := h.registry.Active()
	if activeBackend == nil {
		httpjson.WriteStructuredError(w, http.StatusServiceUnavailable, "no_backend",
			"No wallpaper backend is active. Install and select a backend to set wallpapers.",
			nil,
		)
		return
	}
```

and replace the later `active := h.registry.Active().Name()` with `active := activeBackend.Name()`.

- [ ] **Step 5: Audit the other unguarded call sites**

Run `grep -n "registry.Active()\|\.Active()\." daemon/internal/handler -r`. For each hit in `wallpaperhandler/wallpaper.go` (the audit noted `:110`, `:200`, `:373` alongside `:277`), confirm it is either already behind an `EnsureBackendForMedia` call that fails first, or add the same nil guard. Do not change behaviour beyond preventing the panic.

- [ ] **Step 6: Run the full daemon suite**

Run: `cd daemon && go test -race ./...`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add daemon/internal/backend/registry_impl.go daemon/internal/backend/registry_test.go daemon/internal/handler/wallpaperhandler/wallpaper.go
git commit -m "fix(backend): return nil from Active() instead of panicking

The daemon supports a degraded no-backend start, so GET /wallpaper/current
turned a supported state into a panic and an opaque 500."
```

---

## Task 8: Route `Restore` through the apply gate and order it before playlist restore

**Root cause (a):** `wallpaper.Restore` calls `activeBackend.Apply(ctx, snap)` directly at `restore.go:174`, bypassing `defaultApplyGate`. `Restore` runs on backend activation, config PATCH, and factory reset (`control/controller.go:180,200,221,262`), so a config change concurrent with a playlist tick issues two unordered `Apply` calls to the same backend — the DB records the gated one while the screen shows whichever reached the compositor last.

**Root cause (b):** `daemon.go:202` launches `go wallpaper.Restore(...)` and `:219` then calls `playlistMgr.RestorePersistedRuns(ctx)` with no ordering between them. `startPlaylist` skips its initial apply on `fromPersisted` (`manager.go:167-171`) on the assumption that `Restore` already ran — an assumption nothing enforces.

**Files:**
- Modify: `daemon/internal/wallpaper/serializer.go` (export a gate entry point)
- Modify: `daemon/internal/wallpaper/restore.go` (`Restore`)
- Modify: `daemon/internal/daemon/daemon.go` (`Start`)
- Test: `daemon/internal/wallpaper/restore_test.go`

**Interfaces:**
- Consumes: `defaultApplyGate`, `applyGate.acquire`, `applyGate.release`.
- Produces: new unexported helper `withApplyGate(ctx context.Context, key string, fn func(context.Context) error) error` in `serializer.go`, used by both `Apply` and `Restore`. `Restore`'s signature is unchanged. In `daemon.go`, the startup restore goroutine publishes to a `restoreDone chan struct{}` which `RestorePersistedRuns` waits on with a bounded timeout.

- [ ] **Step 1: Write the failing test**

Append to `daemon/internal/wallpaper/restore_test.go`:

```go
// Regression: Restore called backend.Apply directly, bypassing the apply gate,
// so a config PATCH or backend activation concurrent with a playlist tick could
// reach the compositor out of order relative to the DB writes.
func TestRestoreIsSerialisedWithApply(t *testing.T) {
	var concurrent atomic.Int32
	var maxConcurrent atomic.Int32

	b := &gateProbeBackend{
		onApply: func() {
			n := concurrent.Add(1)
			for {
				m := maxConcurrent.Load()
				if n <= m || maxConcurrent.CompareAndSwap(m, n) {
					break
				}
			}
			time.Sleep(20 * time.Millisecond)
			concurrent.Add(-1)
		},
	}

	// Build the minimal fixtures this file already uses for Restore, with one
	// persisted monitor_state row for a connected monitor and a real image file.
	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			Restore(context.Background(), monStates, stateStore, reg, cfg, monManager, images, nil, nil)
		}()
	}
	wg.Wait()

	assert.Equal(t, int32(1), maxConcurrent.Load(),
		"Restore must hold the per-backend apply gate; saw %d concurrent Apply calls",
		maxConcurrent.Load())
}
```

Add a `gateProbeBackend` fake in this file modelled on the existing `recordingBackend` in `daemon/internal/playlist/restore_test.go`, with an `onApply func()` hook called inside `Apply`. Reuse whatever fixtures `restore_test.go` already builds rather than inventing new ones.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd daemon && go test -race ./internal/wallpaper/ -run TestRestoreIsSerialisedWithApply -v`
Expected: FAIL — `maxConcurrent` > 1.

- [ ] **Step 3: Extract the gate helper**

In `daemon/internal/wallpaper/serializer.go`, append:

```go
// withApplyGate runs fn holding the per-backend apply gate. Returns ErrSuperseded
// when a newer call preempted this one. Every path that drives a backend to a new
// visual state must go through here, or the DB and the screen can disagree.
func withApplyGate(ctx context.Context, key string, fn func(context.Context) error) error {
	gateCtx, ticket := defaultApplyGate.acquire(ctx, key)
	defer defaultApplyGate.release(key, ticket)

	if err := fn(gateCtx); err != nil {
		if ticket.preempted.Load() {
			return ErrSuperseded
		}
		return err
	}
	return nil
}
```

- [ ] **Step 4: Use it in `Restore`**

In `daemon/internal/wallpaper/restore.go`, replace the direct apply:

```go
	applyErr := withApplyGate(ctx, activeBackend.Name(), func(gateCtx context.Context) error {
		return activeBackend.Apply(gateCtx, snap)
	})
	if applyErr != nil {
		if errors.Is(applyErr, ErrSuperseded) {
			slog.Info("restore: superseded by a newer apply", "backend", activeBackend.Name())
			return
		}
		slog.Warn("restore: backend apply failed", "backend", activeBackend.Name(), "error", applyErr)
		if bus != nil {
			bus.Publish(events.Event{
				Type: events.WallpaperRestoreFailed,
				Data: map[string]any{
					"backend": activeBackend.Name(),
					"error":   applyErr.Error(),
				},
			})
		}
		return
	}
```

Add `"errors"` to the imports.

- [ ] **Step 5: Refactor `Apply` to use the same helper**

In `daemon/internal/wallpaper/apply.go`, replace the manual acquire/release block so both paths share one implementation. The persistence and SSE block must stay **inside** the gated function so the critical section still covers the DB writes — that ordering is what makes the existing latest-wins semantics correct, and it must not regress:

```go
	gateKey := opts.Backend.Name()
	return withApplyGate(ctx, gateKey, func(gateCtx context.Context) error {
		if applyErr := opts.Backend.Apply(gateCtx, snap); applyErr != nil {
			if opts.Bus != nil {
				opts.Bus.Publish(events.Event{
					Type: events.WallpaperApplyFailed,
					Data: map[string]any{
						"image_id": opts.Image.ID,
						"error":    applyErr.Error(),
						"backend":  opts.Backend.Name(),
					},
				})
			}
			return fmt.Errorf("backend apply: %w", applyErr)
		}

		// ... existing persistence + history + SSE block, unchanged ...

		return nil
	})
```

Careful: the current code publishes `WallpaperApplyFailed` only when *not* preempted, because it returns `ErrSuperseded` first. With `withApplyGate` the preemption check moves outside, so the SSE would now fire on supersede too. Preserve the old behaviour by checking preemption before publishing — pass the ticket state through, or keep `Apply`'s explicit acquire/release and have only `Restore` use the helper. **Prefer the latter if it keeps the diff smaller**; the goal of this task is to gate `Restore`, not to refactor `Apply`.

- [ ] **Step 6: Order startup restore before playlist restore**

In `daemon/internal/daemon/daemon.go`, replace the restore block at `:188-204`:

```go
	restoreDone := make(chan struct{})
	if !noBackendInstalled {
		if initErr != nil {
			close(restoreDone) // deferred restore owns this path; do not block startup
			wallpaper.StartDeferredDaemonRestore(
				restoreRetryCtx,
				opts.Registry,
				opts.Cfg,
				opts.DB.MonitorStateStore(),
				opts.DB.StateStore(),
				monManager,
				opts.DB.ImageStore(),
				splitter,
				bus,
			)
		} else {
			go func() {
				defer close(restoreDone)
				wallpaper.Restore(restoreRetryCtx, opts.DB.MonitorStateStore(), opts.DB.StateStore(), opts.Registry, opts.Cfg, monManager, opts.DB.ImageStore(), splitter, bus)
			}()
		}
	} else {
		close(restoreDone)
	}
```

Then, immediately before `playlistMgr.RestorePersistedRuns(ctx)`:

```go
	// startPlaylist skips its initial apply on the fromPersisted path because
	// Restore is expected to have already set each monitor. Wait for that to be
	// true rather than assuming it. Bounded so a slow backend cannot block startup.
	select {
	case <-restoreDone:
	case <-time.After(20 * time.Second):
		slog.Warn("startup restore did not finish in time; restoring playlists anyway")
	case <-ctx.Done():
	}
```

- [ ] **Step 7: Run the full daemon suite with race detection**

Run: `cd daemon && go test -race ./...`
Expected: PASS. `daemon_test.go` startup tests must not become slower than their existing timeouts — if any test now waits 20s, it is constructing a backend whose `Apply` never returns; fix the fixture, not the timeout.

- [ ] **Step 8: Commit**

```bash
git add daemon/internal/wallpaper/serializer.go daemon/internal/wallpaper/restore.go daemon/internal/wallpaper/apply.go daemon/internal/wallpaper/restore_test.go daemon/internal/daemon/daemon.go
git commit -m "fix(wallpaper): gate Restore and order it before playlist restore

Restore bypassed the per-backend apply gate, so a config PATCH concurrent
with a playlist tick could reach the compositor out of order. Startup also
raced Restore against RestorePersistedRuns, which assumes Restore already ran."
```

---

## Task 9: Refetch daemon state when the SSE stream reconnects

**Root cause:** `goDaemonClient.scheduleSseReconnect` (`electron/goDaemonClient.ts:170-184`) reconnects with backoff up to 60s. On success it emits `sseReconnected`, `IPCManager` broadcasts `sse_reconnected` (`IPCManager.ts:738`), and the only consumer is a toast at `src/hooks/useNotifications.ts:177`. The daemon's bus does non-blocking sends and logs `"dropping event for slow subscriber"` with no replay, so every event during the gap is lost permanently. After a suspend the renderer's stores keep their pre-suspend values with no path back to truth.

**Files:**
- Create: `src/hooks/useResyncOnReconnect.ts`
- Create: `src/hooks/__tests__/useResyncOnReconnect.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `daemonClient.on(event, handler) => dispose`, `useMonitorStore.getState().reQueryMonitors()`, `useActivePlaylistStore`, and whatever the gallery/current-wallpaper store exposes for refetching.
- Produces: `useResyncOnReconnect(): void` — a hook mounted once from `App.tsx` that, on `sse_reconnected`, refetches monitors, the active-playlist list, and the current wallpaper.

- [ ] **Step 1: Identify the exact refetch entry points**

Read `src/stores/monitors.ts`, `src/stores/activePlaylistStore.ts`, and `src/hooks/useSetLastActivePlaylist.ts`. The active-playlist refresh logic already exists inside `useSetLastActivePlaylist` as a local `refreshActivePlaylist` closure — do **not** duplicate it. Extract it into an exported function or expose an equivalent store action, then call it from both places. Record the exact names you settle on; the test in Step 2 must match them.

- [ ] **Step 2: Write the failing test**

Create `src/hooks/__tests__/useResyncOnReconnect.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useResyncOnReconnect } from "../useResyncOnReconnect";

const handlers: Record<string, (payload: unknown) => void> = {};

vi.mock("@/client", () => ({
  daemonClient: {
    on: (event: string, fn: (payload: unknown) => void) => {
      handlers[event] = fn;
      return () => delete handlers[event];
    },
  },
}));

const reQueryMonitors = vi.fn().mockResolvedValue(undefined);
vi.mock("../../stores/monitors", () => ({
  useMonitorStore: { getState: () => ({ reQueryMonitors }) },
}));

describe("useResyncOnReconnect", () => {
  beforeEach(() => {
    reQueryMonitors.mockClear();
  });

  it("does nothing until the stream reconnects", () => {
    renderHook(() => useResyncOnReconnect());
    expect(reQueryMonitors).not.toHaveBeenCalled();
  });

  it("refetches daemon state on sse_reconnected", async () => {
    renderHook(() => useResyncOnReconnect());

    handlers["sse_reconnected"]?.({});
    await vi.waitFor(() => expect(reQueryMonitors).toHaveBeenCalledTimes(1));
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useResyncOnReconnect());
    unmount();
    expect(handlers["sse_reconnected"]).toBeUndefined();
  });
});
```

Extend the mocks to cover whichever active-playlist and current-wallpaper refetch functions you identified in Step 1, and assert those are called too.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- useResyncOnReconnect`
Expected: FAIL — cannot resolve `../useResyncOnReconnect`.

- [ ] **Step 4: Implement the hook**

Create `src/hooks/useResyncOnReconnect.ts`:

```ts
import { useEffect } from "react";
import { daemonClient } from "@/client";
import { useMonitorStore } from "../stores/monitors";

/**
 * The daemon's event bus does non-blocking sends with no replay, and the SSE
 * client reconnects with backoff up to 60s. Everything published during that gap
 * is lost, so after a suspend or a daemon restart the renderer's stores keep
 * stale values forever. Pull the authoritative state on every reconnect.
 */
export function useResyncOnReconnect(): void {
  useEffect(() => {
    const dispose = daemonClient.on("sse_reconnected", () => {
      void useMonitorStore.getState().reQueryMonitors();
      // plus the active-playlist and current-wallpaper refetches from Step 1
    });
    return dispose;
  }, []);
}
```

Fill in the remaining refetch calls using the exact names from Step 1.

- [ ] **Step 5: Mount it**

In `src/App.tsx`, next to the existing `useLoadMonitors();` call at line 42:

```tsx
  useResyncOnReconnect();
```

with the matching import.

- [ ] **Step 6: Run the renderer suite**

Run: `pnpm test`
Expected: PASS, including all pre-existing tests.

- [ ] **Step 7: Format and lint**

Run: `pnpm run format:check && pnpm run lint:check`
Expected: clean. If not, run the write-mode formatter rather than hand-editing.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useResyncOnReconnect.ts src/hooks/__tests__/useResyncOnReconnect.test.tsx src/App.tsx src/hooks/useSetLastActivePlaylist.ts
git commit -m "fix(ui): refetch daemon state when the SSE stream reconnects

The daemon bus drops events for slow subscribers with no replay and the
client backs off up to 60s, so everything published during a suspend was
lost and the stores kept stale values indefinitely."
```

---

## Task 10: Resync on system resume via Electron `powerMonitor`

**Root cause:** Nothing in the stack knows a suspend happened. `grep -rn "powerMonitor" electron/` returns nothing. The daemon's monitor list is cached for the process lifetime (`monitor/manager_impl.go:90-101`) and its only refresh path is `GET /monitors`, which the renderer calls on mount and on user action only.

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/managers/IPCManager.ts`
- Modify: `src/hooks/useResyncOnReconnect.ts` (from Task 9)
- Test: `src/hooks/__tests__/useResyncOnReconnect.test.tsx`

**Interfaces:**
- Consumes: Electron's `powerMonitor` (`resume` event), `IPCManager.broadcastToAllWindows`, and the Task 9 hook.
- Produces: main process broadcasts channel `go-daemon-event-system_resumed` on `powerMonitor` `resume`. The renderer treats `system_resumed` exactly like `sse_reconnected`.

- [ ] **Step 1: Write the failing test**

Add to `src/hooks/__tests__/useResyncOnReconnect.test.tsx`:

```tsx
  it("refetches daemon state on system_resumed", async () => {
    renderHook(() => useResyncOnReconnect());

    handlers["system_resumed"]?.({});
    await vi.waitFor(() => expect(reQueryMonitors).toHaveBeenCalledTimes(1));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- useResyncOnReconnect`
Expected: FAIL — `handlers["system_resumed"]` is undefined, so `reQueryMonitors` is never called.

- [ ] **Step 3: Subscribe to both events in the hook**

In `src/hooks/useResyncOnReconnect.ts`, replace the single subscription:

```ts
export function useResyncOnReconnect(): void {
  useEffect(() => {
    const resync = () => {
      void useMonitorStore.getState().reQueryMonitors();
      // plus the active-playlist and current-wallpaper refetches
    };

    const disposers = [
      daemonClient.on("sse_reconnected", resync),
      daemonClient.on("system_resumed", resync),
    ];
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, []);
}
```

- [ ] **Step 4: Emit the event from the main process**

In `electron/main.ts`, import `powerMonitor` from `electron` and register alongside the other daemon event wiring:

```ts
  powerMonitor.on("resume", () => {
    logger.info("system resumed from suspend; requesting state resync");
    ipcManager.broadcastToAllWindows("go-daemon-event-system_resumed", {});
  });
```

Use whatever reference to the IPC manager is already in scope in that function; if `broadcastToAllWindows` is private, add the emit inside `IPCManager` and expose a small `notifySystemResumed()` method rather than widening the class's surface.

- [ ] **Step 5: Verify the renderer receives the channel**

Confirm `electron/preload.ts` forwards `go-daemon-event-*` channels generically. If it uses an explicit allowlist, add `system_resumed` to it — otherwise the event is emitted and silently dropped. Check `src/client` for the matching allowlist too.

- [ ] **Step 6: Run the renderer suite and typecheck**

Run: `pnpm test && pnpm run lint:check`
Expected: PASS.

- [ ] **Step 7: Manual verification**

Run `pnpm run dev`, start a timer playlist, suspend the machine (`systemctl suspend`), resume, and confirm from the logs that `system resumed from suspend` is emitted and the monitor list is refetched. Note the result in the commit body if anything differs.

- [ ] **Step 8: Commit**

```bash
git add electron/main.ts electron/managers/IPCManager.ts electron/preload.ts src/hooks/useResyncOnReconnect.ts src/hooks/__tests__/useResyncOnReconnect.test.tsx
git commit -m "feat(electron): resync daemon state on system resume

Nothing in the stack knew a suspend had happened; the daemon caches its
monitor list for the process lifetime and only refreshes on GET /monitors."
```

---

## Task 11: `wal-qt` renderer reports real load outcomes

**Root cause:** `POST /wallpaper/load` responds `202` **before** `loadContent` runs (`wallpaper_controller.cpp:152-154`). The daemon treats any 2xx as success and immediately writes `monitor_state`, history, and the `wallpaper_changed` SSE. Every post-ack failure — unresolved web target (`wallpaper_window.cpp:284-288`), unknown kind (`:263-267`), renderer decode error — is invisible. `/wallpaper/status` cannot help either: `loadImageOrVideo` commits `currentTarget_`/`currentKind_` optimistically (`:332-335`).

The renderer already has everything needed: `handleLoad` (`renderer/src/main.ts:172-217`) distinguishes superseded (`AbortError`), failed (`catch`), and success, and `req.request_id` is already threaded through. `WallpaperBridge` already proves the JS→C++ direction works via `rendererReady()`.

**Files:**
- Modify: `wal-qt/src/wallpaper/wallpaper_bridge.h`
- Modify: `wal-qt/src/wallpaper/wallpaper_bridge.cpp`
- Modify: `wal-qt/renderer/src/renderer/walBridge.d.ts`
- Modify: `wal-qt/renderer/src/main.ts`
- Test: `wal-qt/renderer/src/renderer/loadResult.test.ts` (create)

**Interfaces:**
- Consumes: existing `WallpaperBridge`, `LoadRequest.request_id`, `LoadRequest.monitor_id`.
- Produces: `Q_INVOKABLE void loadResult(int requestId, int monitorId, const QString &outcome, const QString &error)` on `WallpaperBridge`, plus a C++ signal `loadResultReported(int requestId, int monitorId, const QString &outcome, const QString &error)` for `WallpaperWindow` to relay. `outcome` is exactly one of `"applied"`, `"superseded"`, `"failed"`.

- [ ] **Step 1: Write the failing renderer test**

Create `wal-qt/renderer/src/renderer/loadResult.test.ts`. Test the outcome-classification function in isolation rather than the whole `handleLoad` closure:

```ts
import { describe, expect, it } from "vitest";
import { classifyLoadOutcome } from "./loadResult";

describe("classifyLoadOutcome", () => {
  it("reports applied when the load resolved", () => {
    expect(classifyLoadOutcome(null)).toEqual({ outcome: "applied", error: "" });
  });

  it("reports superseded for an AbortError", () => {
    const err = new DOMException("Superseded by newer load", "AbortError");
    expect(classifyLoadOutcome(err)).toEqual({ outcome: "superseded", error: "" });
  });

  it("reports failed with the message for a real error", () => {
    expect(classifyLoadOutcome(new Error("decode failed"))).toEqual({
      outcome: "failed",
      error: "decode failed",
    });
  });

  it("stringifies non-Error throwables", () => {
    expect(classifyLoadOutcome("boom")).toEqual({ outcome: "failed", error: "boom" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd wal-qt/renderer && npm run test -- loadResult`
Expected: FAIL — cannot resolve `./loadResult`.

- [ ] **Step 3: Implement the classifier**

Create `wal-qt/renderer/src/renderer/loadResult.ts`:

```ts
export type LoadOutcome = "applied" | "superseded" | "failed";

export interface LoadResult {
  outcome: LoadOutcome;
  error: string;
}

/**
 * Classify the terminal state of a load so the host can answer the daemon
 * truthfully. Supersede is not a failure: it is the expected result of
 * latest-wins when a newer request arrives mid-transition.
 */
export function classifyLoadOutcome(error: unknown): LoadResult {
  if (error === null || error === undefined) {
    return { outcome: "applied", error: "" };
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return { outcome: "superseded", error: "" };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { outcome: "failed", error: message };
}
```

- [ ] **Step 4: Report from `handleLoad`**

In `wal-qt/renderer/src/main.ts`, import the classifier and report at every terminal point of the `run` async IIFE. The three exits are: the early `generation !== myGeneration` return (superseded), the `catch` (AbortError → superseded, otherwise failed), and normal completion (applied). Restructure the body so exactly one report fires per request:

```ts
  const run = (async (): Promise<void> => {
    await previous.catch(() => {});

    if (generation !== myGeneration) {
      reportLoadResult(req, { outcome: "superseded", error: "" });
      return;
    }

    const checkNotStale: LoadStaleCheck = () => {
      if (generation !== myGeneration) {
        throw new DOMException("Superseded by newer load", "AbortError");
      }
    };

    state.busy = true;
    state.transitionInFlight = true;
    let thrown: unknown = null;
    try {
      if (req.kind !== "web" && req.parallax?.enabled) {
        applyParallaxBaselineForLoad(req.parallax);
      }
      await applyLoadRequest(req, checkNotStale);
    } catch (error) {
      thrown = error;
      const result = classifyLoadOutcome(error);
      if (result.outcome === "failed") {
        logger.warn("transition failed", { requestId: req.request_id, error: result.error });
      }
    } finally {
      if (generation === myGeneration) {
        state.transitionInFlight = false;
        state.busy = false;
        flushDeferred();
      }
      reportLoadResult(req, classifyLoadOutcome(thrown));
    }
  })();
```

Add the reporter near the bridge wiring:

```ts
function reportLoadResult(req: LoadRequest, result: LoadResult): void {
  bridge?.loadResult?.(req.request_id, req.monitor_id, result.outcome, result.error);
}
```

using whatever the module already calls the bridge object (see `b.rendererReady?.()` at `main.ts:333`).

- [ ] **Step 5: Declare it on the bridge type**

In `wal-qt/renderer/src/renderer/walBridge.d.ts`, add alongside `rendererReady`:

```ts
    loadResult: (requestId: number, monitorId: number, outcome: string, error: string) => void;
```

- [ ] **Step 6: Add the C++ invokable**

In `wal-qt/src/wallpaper/wallpaper_bridge.h`, add to `public slots:`:

```cpp
    // Called by the qrc renderer when a load reaches a terminal state. outcome is
    // "applied", "superseded", or "failed". This is what lets the host answer
    // POST /wallpaper/load truthfully instead of acking before it loads anything.
    Q_INVOKABLE void loadResult(int requestId, int monitorId,
                                const QString &outcome, const QString &error);
```

and to `signals:`:

```cpp
    void loadResultReported(int requestId, int monitorId,
                            const QString &outcome, const QString &error);
```

In `wal-qt/src/wallpaper/wallpaper_bridge.cpp`:

```cpp
void walqt::WallpaperBridge::loadResult(int requestId, int monitorId,
                                        const QString &outcome, const QString &error)
{
    emit loadResultReported(requestId, monitorId, outcome, error);
}
```

- [ ] **Step 7: Run the renderer checks and the C++ build**

Run: `cd wal-qt/renderer && npm run check:all:strict`
Expected: PASS.

Run: `cd wal-qt && make build`
Expected: builds clean.

- [ ] **Step 8: Commit**

```bash
cd wal-qt
git add src/wallpaper/wallpaper_bridge.h src/wallpaper/wallpaper_bridge.cpp renderer/src/renderer/loadResult.ts renderer/src/renderer/loadResult.test.ts renderer/src/renderer/walBridge.d.ts renderer/src/main.ts
git commit -m "feat(renderer): report terminal load outcomes to the host

The renderer already distinguished applied/superseded/failed internally but
only logged failures, so the host had nothing to answer the daemon with."
```

---

## Task 12: `wal-qt` responds to `/wallpaper/load` only after every target reports

**Files:**
- Modify: `wal-qt/src/wallpaper/wallpaper_window.h` / `.cpp`
- Modify: `wal-qt/src/wallpaper/wallpaper_controller.h` / `.cpp`
- Modify: `wal-qt/openapi/` (the load response schema)
- Test: `wal-qt/tests/` (add a load-completion test alongside the existing ctest cases)

**Interfaces:**
- Consumes: `WallpaperBridge::loadResultReported` from Task 11, `HttpResponder` (a copyable `std::function` already guarded by `QPointer<QLocalSocket>`, safe to hold across the event loop).
- Produces: **breaking response change.** `POST /wallpaper/load` now returns `200` after all targets report, with body:

```json
{
  "ok": true,
  "request_id": 42,
  "results": [
    { "name": "DP-1", "outcome": "applied" },
    { "name": "HDMI-A-1", "outcome": "failed", "error": "unresolved target: /x/y" }
  ]
}
```

`outcome` ∈ `"applied" | "superseded" | "failed" | "timeout"`. `ok` is `true` when every result is `applied` or `superseded`. Still `404` when no monitors match, `400` on bad JSON. `wait_for_completion` is **removed** from the request schema — it was already a documented no-op and completion is now unconditional.

- [ ] **Step 1: Assign a host-side request id and expose per-window load results**

`WallpaperWindow::loadContent` currently mints its own `request_id` from a function-local `static int sRequestId` (`wallpaper_window.cpp:339`), which is per-process but not visible to the controller. Change `loadContent` to accept the id from the caller:

```cpp
    void loadContent(const QJsonObject &req, int requestId);
```

and emit a new signal when the load reaches a terminal state:

```cpp
signals:
    void loadFinishedForRequest(int requestId, const QString &monitorName,
                                const QString &outcome, const QString &error);
```

Wire it from three sources:
1. `WallpaperBridge::loadResultReported` — for image/video, matching on `requestId`.
2. `QWebEngineView::loadFinished(bool)` — for web packages, where the renderer bridge is gone. Emit `applied` on `true`, `failed` on `false`.
3. The early-return failure paths in `loadWebPackage` (unresolved target, `:284-288`) and `loadContent` (unknown kind, `:263-267`) — emit `failed` immediately instead of only `qWarning`.

- [ ] **Step 2: Collect results in the controller**

Replace `WallpaperController::handleLoad` (`wallpaper_controller.cpp:140-155`) with a version that holds the responder until all targets report or a deadline fires:

```cpp
void WallpaperController::handleLoad(const QJsonObject &req, HttpResponder respond)
{
    auto targets = resolve(decodeLoadSelector(req), windows_);
    if (targets.isEmpty()) {
        respond(404, R"({"error":"no matching monitors"})");
        return;
    }

    const int requestId = ++lastRequestId_;

    auto pending = std::make_shared<PendingLoad>();
    pending->respond   = respond;
    pending->requestId = requestId;
    for (auto *w : targets)
        pending->outstanding.insert(w->screenName());

    pendingLoads_.insert(requestId, pending);

    // Bounded so a wedged renderer produces a truthful "timeout" rather than
    // letting the daemon's transport time out ambiguously. Must stay below the
    // daemon's load_timeout_ms (default 15000).
    auto *deadline = new QTimer(this);
    deadline->setSingleShot(true);
    connect(deadline, &QTimer::timeout, this, [this, requestId] { finalizeLoad(requestId, true); });
    deadline->start(loadAckTimeoutMs_);
    pending->deadline = deadline;

    for (auto *w : targets)
        w->loadContent(req, requestId);
}
```

Add `onLoadFinishedForRequest` to record one result and call `finalizeLoad(requestId, false)` once `outstanding` is empty. `finalizeLoad` builds the JSON above, responds exactly once, stops and deletes the timer, and erases the map entry. Guard against double-responding: the timeout and the last ack can race on the Qt event loop only if you re-enter, so an `already responded` flag on `PendingLoad` is required.

Add `loadAckTimeoutMs_` (default `10000`) as a member, and `lastRequestId_` as an `int` member replacing the function-local static in `wallpaper_window.cpp`.

- [ ] **Step 3: Make `/wallpaper/status` report real per-monitor state**

Give `WallpaperWindow` a `loadState_` enum (`never_loaded`, `loading`, `displayed`, `failed`) set at the same three points as the signal, and report it in `statusJson()` (`wallpaper_controller.cpp:292-309`) as a `load_state` field per monitor. Keep `current_kind`/`current_target` as they are.

This is what makes `onScreenAdded`'s blank window (`:68-80`) visible: a hot-plugged screen reports `never_loaded` instead of looking healthy, which gives the daemon a cheap reconciliation probe.

- [ ] **Step 4: Update the OpenAPI spec**

Update `wal-qt/openapi/` for the new load response schema and remove `wait_for_completion` from the request. The daemon's generated client (`daemon/internal/backend/walqt/walqtclient/`) is regenerated from this in Task 13.

- [ ] **Step 5: Add a ctest case**

Add a test alongside the existing `wal-qt/tests/` cases covering: (a) all targets report `applied` → `200` with `ok: true`; (b) one target reports `failed` → `200` with `ok: false` and that target's error present; (c) a target that never reports → `timeout` after `loadAckTimeoutMs_`. Follow the existing test file's fixture style.

- [ ] **Step 6: Build and test**

Run: `cd wal-qt && make build && make test && make check`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
cd wal-qt
git add -A
git commit -m "feat(host)!: answer /wallpaper/load only after targets report

BREAKING: the load response is now sent after every target reaches a
terminal state, with per-target outcomes. wait_for_completion is removed;
it was already a no-op. Acking before loading made every post-ack failure
invisible to the daemon, which recorded wallpapers that never displayed."
```

---

## Task 13: Daemon trusts the new load response

**Files:**
- Modify: `daemon/internal/backend/walqt/walqtclient/` (regenerate from the updated OpenAPI)
- Modify: `daemon/internal/backend/walqt/client.go` (`load`)
- Modify: `daemon/internal/backend/walqt/walqt.go` (`Apply`)
- Modify: `daemon/internal/backend/walqt/config.go` (timeout defaults)
- Test: `daemon/internal/backend/walqt/walqt_test.go`

**Interfaces:**
- Consumes: the Task 12 response shape.
- Produces: `controlClient.load` returns a decoded per-target result set. `WalQt.Apply` returns `nil` only when every target is `applied` or `superseded`, and otherwise returns an error naming the failed monitors and their messages.

**Scoping decision — read this before implementing:** `wallpaper.Apply` currently persists `monitor_state` and history for *every* monitor in the snapshot, all-or-nothing (`apply.go:88-102`). Making persistence per-monitor is a larger refactor and is **out of scope**. For this task, if *any* target fails, `WalQt.Apply` returns an error, so nothing is persisted and the existing `wallpaper_apply_failed` SSE fires. That is strictly better than today (where nothing fails) and keeps the DB honest. Partial-success persistence is a follow-up.

- [ ] **Step 1: Regenerate the client**

Find the generation command (check `wal-qt/Makefile`, `daemon/Makefile`, or a `go:generate` directive near `walqtclient/`) and regenerate against the updated `wal-qt/openapi/`. Do not hand-edit generated files.

- [ ] **Step 2: Write the failing test**

Add to `daemon/internal/backend/walqt/walqt_test.go` a table-driven test that stands up an `httptest` server over a Unix socket (follow the existing test fixtures in this package) returning each response shape, and asserts:

| Response | Expected `Apply` result |
|---|---|
| all `applied` | `nil` |
| mix of `applied` + `superseded` | `nil` |
| one `failed` | error containing that monitor name and its error message |
| one `timeout` | error containing that monitor name |
| non-2xx | existing retry/classify behaviour, unchanged |

- [ ] **Step 3: Run test to verify it fails**

Run: `cd daemon && go test ./internal/backend/walqt/ -v`
Expected: FAIL — `Apply` currently returns `nil` for every 2xx regardless of body.

- [ ] **Step 4: Decode and enforce the results**

In `client.go`, decode the response body into a typed result struct. In `walqt.go`'s `Apply`, replace the bare `statusCode >= 200 && statusCode < 300` success branch (`:864`) with a check over the per-target outcomes. Keep the existing retry loop for *transport* and *transient HTTP status* failures — but a decoded `failed` outcome is **not** retryable: the renderer already tried and reported a real error, so retrying just delays the failure. Return it immediately.

- [ ] **Step 5: Align the timeouts**

In `config.go`, confirm `LoadTimeoutMS` (default 15000) stays comfortably above `wal-qt`'s `loadAckTimeoutMs_` (10000) so a renderer hang surfaces as a truthful `timeout` outcome rather than an ambiguous transport timeout. Add a comment stating the relationship so neither drifts.

- [ ] **Step 6: Delete the now-dead retry helper**

`getStatusWithRetry` (`walqt.go:313`) is unreachable and its stated purpose — tolerating a cold control socket after spawn — is now handled by the acked load path. Remove it. Confirm with `grep -rn "getStatusWithRetry" daemon/` that nothing references it.

- [ ] **Step 7: Run the full daemon suite**

Run: `cd daemon && go test -race ./...`
Expected: PASS.

- [ ] **Step 8: End-to-end verification**

With the Task 12 `wal-qt` build installed on `PATH` as `wal-qt-host`, run `pnpm run dev`, set a wallpaper, and confirm from the daemon logs that the load response carries per-target outcomes. Then set a deliberately broken web wallpaper (point a manifest at a missing entry file) and confirm the daemon reports failure and does **not** write `monitor_state` — the exact bug this whole task exists to fix.

- [ ] **Step 9: Commit**

```bash
git add daemon/internal/backend/walqt/
git commit -m "fix(walqt): treat load as successful only when targets confirm

wal-qt now reports per-target outcomes, so stop recording a wallpaper as
applied on the strength of an ack that was sent before anything loaded."
```

---

## Execution Order and Parallelism

Tasks 1–4 all edit `scheduler.go` and `manager.go` and **must run sequentially in one agent**. The rest group into non-overlapping file sets:

| Wave | Agent | Tasks | Files touched |
|---|---|---|---|
| 1 | A | 1, 2, 3, 4 | `daemon/internal/playlist/**` |
| 1 | B | 5 | `daemon/internal/store/**`, `daemon/internal/wallpaper/snapshot*.go` |
| 1 | E | 9, 10 | `src/**`, `electron/**` |
| 1 | F | 11, 12 | `wal-qt/**` (separate repo) |
| 2 | C | 6, 7 | `daemon/internal/backend/**`, `control/controller.go`, `playlist/manager.go` |
| 2 | D | 8 | `daemon/internal/wallpaper/{serializer,restore,apply}.go`, `daemon/internal/daemon/daemon.go` |
| 3 | G | 13 | `daemon/internal/backend/walqt/**` |

Wave 2 runs after Wave 1 because Task 6 edits `playlist/manager.go` (Agent A's file) and Task 8 edits `wallpaper/apply.go` next to Agent B's `wallpaper/snapshot.go`. Wave 3 runs after Task 12 lands the new `wal-qt` contract.

After every wave: `pnpm run ci:check` from `waypaper-engine/` must be green before the next wave starts.

## Self-Review Notes

- **Spec coverage:** every confirmed finding from the audit has a task — scheduler `NextChangeAt` (1), timer suspend recovery (2), scheduler goroutine leak/race (3), day_of_week paused fire (4), monitor-state atomicity + snapshot dedupe (5), backend switch atomicity (6), `Active()` panic (7), restore gating + startup ordering (8), SSE resync (9), power resume (10), wal-qt truthful ack (11–13). The findings deliberately **not** actioned: manual-set-vs-playlist (confirmed intended behaviour by the maintainer), idle wal-qt crash supervision (dismissed — `ensureRunning` respawns on next Apply), unbounded history growth, and `PreviousImageID` off-by-one.
- **Known risk in Task 8, Step 5:** the `Apply` refactor can regress the `WallpaperApplyFailed`-not-fired-on-supersede behaviour. The step calls this out and permits the smaller diff (gate only `Restore`). A reviewer should check that `apply_test.go`'s supersede cases still pass.
- **Known risk in Task 5, Step 3:** the CloverDB v2 `Update` signature is assumed. The step says to verify it and states the real invariant (never delete before insert) so the implementer can adapt without losing the point.
- **Open question carried into execution:** the maintainer reported the stuck progress bar on a fresh start; my probe showed `timer` schedulers already publish `NextChangeAt` synchronously, so Task 1 fixes it only if the affected playlist is `time_of_day` or `day_of_week`. If it reproduces on a `timer` playlist after Task 1, there is a second root cause not covered by this plan.
