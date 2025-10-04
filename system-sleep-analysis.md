# System Sleep/Restart Behavior Analysis - Time-of-Day Playlists

## Executive Summary

**CRITICAL ISSUE IDENTIFIED:** Current Go implementation does NOT handle system sleep correctly.
This is **Feature 12.5** from the parity analysis - marked as P0 (Critical Priority).

---

## Scenario Analysis

### Scenario 1: Machine Sleep Before Timer Fires

**Setup:**
- Current time: 11:55 AM
- Next image scheduled: 12:00 PM (noon)
- Timer set for: 5 minutes (300 seconds)

**What Happens:**

```
11:55:00 ────────> [Timer set for 5 minutes]
                   Timer internal state: fire_at = now + 300s
                   
11:56:00 ────────> [User suspends laptop] 💤
                   OS freezes all timers
                   Timer thinks: "I still have 240s to go"
                   
[4 hours pass in real time while machine sleeps]

15:56:00 ────────> [User resumes laptop] 🔓
                   OS unfreezes timers
                   Timer: "Oh, I have 240s left!"
                   
15:57:00 ────────> [Timer fires - 240s after resume] ⏰
                   ❌ WRONG! Should have fired at 12:00 PM (4 hours ago)
                   ❌ Now shows noon image at 3:57 PM
                   ❌ Displacement: 3 hours 57 minutes
```

**Result:**
- ❌ Timer displacement equal to sleep duration
- ❌ Wrong image displayed for hours
- ❌ Subsequent transitions also wrong
- ❌ Only fixes itself at next scheduled time (6 PM in this case)

---

### Scenario 2: Machine Sleep After Timer Should Have Fired

**Setup:**
- Current time: 11:55 AM
- Next image scheduled: 12:00 PM
- Timer set for: 5 minutes

**What Happens:**

```
11:55:00 ────────> [Timer set for 5 minutes]
                   
11:56:00 ────────> [User suspends laptop] 💤
                   
[1 hour passes in real time]

12:56:00 ────────> [User resumes laptop] 🔓
                   Timer: "I still have 240s left!"
                   Showing: Morning image (8 AM)
                   ❌ WRONG! Should be showing noon image
                   
12:57:00 ────────> [Timer finally fires] ⏰
                   Changes to noon image
                   ✓ Now correct (but was wrong for 1 minute)
```

**Result:**
- ❌ Wrong image shown for (sleep_duration - remaining_time)
- ❌ In this case: 1 hour - 4 minutes = 56 minutes of wrong image

---

### Scenario 3: Daemon Restart

**Setup:**
- Current time: 2:30 PM
- Images scheduled: 8 AM, 12 PM, 6 PM
- Daemon crashes and restarts

**What Happens:**

```
14:30:00 ────────> [Daemon crashes] ❌
                   All playlist state lost
                   
14:30:05 ────────> [Daemon restarts] 🔄
                   runTimeOfDayPlaylist() called
                   findClosestImageIndex(current_time = 14:30)
                   ✓ Finds index 1 (12 PM image - most recent)
                   ✓ Sets noon image
                   ✓ Calculates next: 6 PM - 2:30 PM = 3h 30m
                   ⏰ Sets timer for 3h 30m
                   
18:00:00 ────────> [Timer fires] ⏰
                   ✓ Changes to evening image
                   ✓ Works correctly!
```

**Result:**
- ✅ Daemon restart is handled correctly!
- ✅ findClosestImageIndex() recalculates from current time
- ✅ No user intervention needed

---

### Scenario 4: Machine Restart

**Setup:**
- Machine reboots
- Playlists configured to auto-start

**What Happens:**

```
[Machine boots] 🔄
[Daemon starts] 🔄
[Playlists restored from database] 💾

Current time: 14:30:00
runTimeOfDayPlaylist() called with fresh state
findClosestImageIndex(14:30)
✓ Finds 12 PM image
✓ Sets correct image
✓ Schedules next transition
✓ Works perfectly!
```

**Result:**
- ✅ Machine restart is handled correctly!
- ✅ Same as daemon restart - findClosestImageIndex() fixes it

---

## Why Daemon/Machine Restart Works But Sleep Doesn't

### Restart Flow:
```go
// On restart, runTimeOfDayPlaylist() is called fresh:
func (m *Manager) runTimeOfDayPlaylist(ctx context.Context, instance *Instance) {
    currentTime := getCurrentTimeInMinutes()  // ✓ Gets ACTUAL current time
    closestIndex := findClosestImageIndex(instance.Playlist, currentTime)
    m.setImage(ctx, instance, int64(closestIndex))  // ✓ Sets correct image
    duration := calculateDurationUntilNextImage(instance.Playlist, closestIndex)
    instance.Timer = time.NewTimer(duration)  // ✓ New timer with correct duration
}
```

**Key:** Fresh start means we query real time and recalculate everything.

### Sleep/Resume Flow:
```go
// Timer was created BEFORE sleep:
instance.Timer = time.NewTimer(duration)  // Created at 11:55 AM for 5 minutes

// During sleep: Timer is frozen by OS

// After resume: Timer continues with remaining time
// NO CODE RUNS to check if current time makes sense
// Timer just fires when countdown finishes
```

**Problem:** No mechanism to detect that real time has advanced beyond expected fire time.

---

## The Node.js Solution: checkMissedEvents()

### How It Works:

```typescript
async checkMissedEvents() {
    clearTimeout(this.eventCheckerTimeout);
    this.eventCheckerTimeout = setInterval(() => {
        const now = Date.now();
        
        // Check if scheduled time has passed without timer firing
        if (
            this.playlistTimer.executionTimeStamp === undefined ||
            now < this.playlistTimer.executionTimeStamp ||
            this.playlistTimer.timeoutID === undefined ||
            this.currentType === undefined
        ) {
            return;  // Everything is fine
        }
        
        // Current time > expected fire time, but timer hasn't fired yet
        // This means system was suspended!
        clearTimeout(this.playlistTimer.timeoutID);
        
        switch (this.currentType) {
            case PLAYLIST_TYPES.TIME_OF_DAY:
                void this.timeOfDayPlaylist();  // Re-evaluate and set correct image
                break;
            case PLAYLIST_TYPES.DAY_OF_WEEK:
                void this.dayOfWeekPlaylist();
                break;
        }
    }, 10_000);  // Check every 10 seconds
}
```

### Key Concept:

```
executionTimeStamp = when timer SHOULD fire (real wall-clock time)
currentTime = actual wall-clock time right now

if currentTime > executionTimeStamp and timer hasn't fired:
    → System must have been suspended
    → Cancel timer
    → Re-evaluate playlist (which will find correct image for current time)
```

### Example:

```
11:55:00 ────────> Timer set for 5 minutes
                   executionTimeStamp = 12:00:00
                   
[Check at 11:55:10]
now = 11:55:10
executionTimeStamp = 12:00:00
11:55:10 < 12:00:00 ✓ OK, timer hasn't fired yet (expected)

[User suspends at 11:56:00]

[User resumes at 15:56:00]

[Check at 15:56:10]
now = 15:56:10
executionTimeStamp = 12:00:00
15:56:10 > 12:00:00 ❌ PROBLEM! Timer should have fired 4 hours ago!
→ Cancel timer
→ Call timeOfDayPlaylist() to re-evaluate
→ findClosestImageIndex(15:56) → finds 12 PM image
→ Sets correct image (noon)
→ Schedules next at 6 PM
→ Fixed within 10 seconds of resume!
```

---

## Current Go Implementation Status

### What Works ✅
- Daemon restart
- Machine restart  
- Normal operation without sleep

### What Doesn't Work ❌
- System sleep/suspend
- System hibernate
- Clock adjustments (daylight saving time, manual time change)

### Impact
```
User Scenario:
- Sets up time-of-day playlist (morning, noon, evening images)
- Closes laptop at 11:55 AM (5 min before noon transition)
- Opens laptop at 3 PM
- Expects: Afternoon image
- Gets: Morning image (won't change until timer fires 4 hours late)
- Image finally changes at ~3:05 PM (65+ minutes wrong)

This is a BAD user experience!
```

---

## Proposed Solution for Go Implementation

### Option 1: Background Checker Goroutine (Node.js approach)

```go
func (m *Manager) runTimeOfDayPlaylistWithSleepDetection(ctx context.Context, instance *Instance) {
    currentTime := getCurrentTimeInMinutes()
    closestIndex := findClosestImageIndex(instance.Playlist, currentTime)
    m.setImage(ctx, instance, int64(closestIndex))
    
    duration := calculateDurationUntilNextImage(instance.Playlist, closestIndex)
    instance.Timer = time.NewTimer(duration)
    
    // Store when timer SHOULD fire (real wall-clock time)
    expectedFireTime := time.Now().Add(duration)
    
    // Background checker to detect missed events
    checker := time.NewTicker(10 * time.Second)
    defer checker.Stop()
    
    for {
        select {
        case <-instance.Timer.C:
            // Normal timer fired
            currentTime := getCurrentTimeInMinutes()
            nextIndex := findClosestImageIndex(instance.Playlist, currentTime)
            m.setImage(ctx, instance, int64(nextIndex))
            
            duration = calculateDurationUntilNextImage(instance.Playlist, nextIndex)
            instance.Timer.Reset(duration)
            expectedFireTime = time.Now().Add(duration)
            
        case <-checker.C:
            // Check if we've missed the expected fire time
            if time.Now().After(expectedFireTime) && instance.Timer != nil {
                // Missed event detected! (system was likely suspended)
                m.logger.Warn("detected missed timer event, re-evaluating playlist",
                    "playlist", instance.Playlist.Playlist.Name,
                    "expectedFireTime", expectedFireTime,
                    "now", time.Now())
                
                // Stop the stale timer
                instance.Timer.Stop()
                
                // Re-evaluate from current time
                currentTime := getCurrentTimeInMinutes()
                nextIndex := findClosestImageIndex(instance.Playlist, currentTime)
                m.setImage(ctx, instance, int64(nextIndex))
                
                // Reschedule
                duration = calculateDurationUntilNextImage(instance.Playlist, nextIndex)
                instance.Timer = time.NewTimer(duration)
                expectedFireTime = time.Now().Add(duration)
            }
            
        case <-instance.Done:
            return
        case <-ctx.Done():
            return
        }
    }
}
```

**Pros:**
- Catches sleep/suspend within 10 seconds of resume
- Minimal overhead (1 wake-up per 10 seconds)
- Proven approach from Node.js

**Cons:**
- Additional wake-ups (6 per minute = 8,640 per day)
- Not perfectly efficient (though still way better than old polling)

### Option 2: Deadline-Based Timer (More Go-idiomatic)

```go
func (m *Manager) runTimeOfDayPlaylistDeadlineBased(ctx context.Context, instance *Instance) {
    for {
        currentTime := getCurrentTimeInMinutes()
        closestIndex := findClosestImageIndex(instance.Playlist, currentTime)
        m.setImage(ctx, instance, int64(closestIndex))
        
        duration := calculateDurationUntilNextImage(instance.Playlist, closestIndex)
        deadline := time.Now().Add(duration)
        
        // Use a timer but verify deadline when it fires
        timer := time.NewTimer(duration)
        
        select {
        case fireTime := <-timer.C:
            // Check if we fired at the right time
            delay := fireTime.Sub(deadline)
            
            if delay > 30*time.Second {
                // Significant delay - likely system suspend
                m.logger.Warn("timer fired late, re-evaluating",
                    "playlist", instance.Playlist.Playlist.Name,
                    "delay", delay)
                // Loop will re-evaluate from current time
            } else {
                // Normal firing, proceed to next image
            }
            
        case <-instance.Done:
            timer.Stop()
            return
        case <-ctx.Done():
            timer.Stop()
            return
        }
    }
}
```

**Pros:**
- No additional checker goroutine
- Zero overhead during normal operation
- Catches large time jumps

**Cons:**
- Only detects sleep when timer fires (could be hours late)
- Won't help if sleep happens right before scheduled time

### Option 3: Hybrid Approach (RECOMMENDED)

```go
// Use deadline-based timer with occasional sanity checks
// Check every 5 minutes instead of 10 seconds
// Balances efficiency with responsiveness
```

---

## Comparison of Wake-ups

```
NO SLEEP DETECTION (current):
├─ Normal operation: 3 wake-ups/day (only transitions)
├─ With sleep/resume: 3 wake-ups/day + user sees wrong image
└─ Total: 3 wake-ups/day (but broken UX)

OPTION 1 (Background checker every 10s):
├─ Normal operation: 3 + (8,640 checks) = 8,643 wake-ups/day
├─ With sleep/resume: 8,643 wake-ups/day + fixed within 10s
└─ Total: 8,643 wake-ups/day (6x worse than old polling, but UX fixed)

OPTION 2 (Deadline-based):
├─ Normal operation: 3 wake-ups/day
├─ With sleep/resume: 3 wake-ups/day + detects at next timer fire
└─ Total: 3 wake-ups/day (efficient but slow to recover)

OPTION 3 (Hybrid - check every 5 minutes):
├─ Normal operation: 3 + (288 checks) = 291 wake-ups/day
├─ With sleep/resume: 291 wake-ups/day + fixed within 5 min
└─ Total: 291 wake-ups/day (balanced - 5x better than old, fixes UX)
```

---

## Recommended Implementation

**Use Option 3 (Hybrid)** with 5-minute sanity checks:
- Still 5x more efficient than old implementation
- Fixes sleep issues within 5 minutes (acceptable)
- Low overhead (291 wake-ups vs old 1,440)
- Good balance of efficiency and UX

---

## Testing Plan

```go
func TestTimeOfDayPlaylist_SleepRecovery(t *testing.T) {
    // Simulate system suspend
    // 1. Start playlist at 11:55 AM
    // 2. Next image at 12:00 PM
    // 3. Manually advance time to 3 PM (simulating sleep)
    // 4. Wait for sanity check interval
    // 5. Verify correct image is shown (noon or evening)
}
```

---

## Summary Table

| Scenario | Current Behavior | Desired Behavior | Status |
|----------|-----------------|------------------|--------|
| **Daemon restart** | ✅ Re-evaluates, sets correct image | ✅ Same | ✅ Works |
| **Machine restart** | ✅ Re-evaluates, sets correct image | ✅ Same | ✅ Works |
| **System sleep** | ❌ Timer displaced, wrong image | ✅ Detects and fixes | ❌ Missing |
| **Clock change** | ❌ Timer based on old time | ✅ Detects and adjusts | ❌ Missing |

**Priority:** P0 (Critical) - Common laptop usage pattern
**Effort:** Medium (1-2 hours implementation + testing)
**User Impact:** High (affects all laptop users who suspend)

