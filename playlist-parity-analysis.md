# Playlist Feature Parity Analysis: TypeScript vs Go Daemon

## Overview
This document compares the playlist functionality between the old TypeScript daemon and the new Go daemon to identify missing features.

## ✅ Features with Full Parity

| Feature | TypeScript | Go | Status |
|---------|-----------|-----|--------|
| **Timer Playlist** | ✓ | ✓ | ✅ Complete |
| **Pause/Resume** | ✓ Timer only | ✓ Timer only | ✅ Complete |
| **Stop Playlist** | ✓ | ✓ | ✅ Complete |
| **Next/Previous Image** | ✓ | ✓ | ✅ Complete |
| **Random Image** | ✓ | ✓ | ✅ Complete |
| **Event System** | ✓ | ✓ | ✅ Complete |

## ❌ Missing Features in Go Daemon

### 1. **Never Playlist - No Initial Image Set** 🔴 CRITICAL
**TypeScript Implementation:**
```typescript
async neverPlaylist(firstPlay = false) {
    if (!firstPlay) return;
    await this.setImage(this.images[this.currentImageIndex]);
}
```

**Go Implementation:**
```go
case Never:
    // Do nothing
```

**Impact:** When a "never" type playlist starts, no image is set. The user expects the current image to be displayed.

**Expected Behavior:** Set the image once when playlist starts, then do nothing.

---

### 2. **Time of Day - Missing findClosestImageIndex()** 🔴 CRITICAL
**TypeScript Implementation:**
```typescript
async timeOfDayPlaylist() {
    const startingIndex = this.findClosestImageIndex(); // Binary search
    if (startingIndex === undefined) {
        notify("Images have no time, something went wrong");
        return;
    }
    this.currentImageIndex = startingIndex < 0 ? this.images.length - 1 : startingIndex;
    await this.setImage(this.images[this.currentImageIndex]);
    this.timeOfDayPlayer(); // Schedule next change
}

findClosestImageIndex() {
    const date = new Date();
    const currentTime = date.getHours() * 60 + date.getMinutes();
    let low = 0;
    let high = this.images.length - 1;
    let closestIndex = -1;
    
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const midTime = this.images[mid].time;
        if (midTime === null) return undefined;
        if (midTime === currentTime) {
            return mid;
        } else if (midTime < currentTime) {
            closestIndex = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return closestIndex;
}
```

**Go Implementation:**
```go
func (m *Manager) runTimeOfDayPlaylist(ctx context.Context, instance *Instance) {
    ticker := time.NewTicker(1 * time.Minute)
    defer ticker.Stop()
    
    for {
        select {
        case now := <-ticker.C:
            for i, img := range instance.Playlist.Images {
                if img.Time.Valid {
                    hour := int(img.Time.Int64 / 100)
                    minute := int(img.Time.Int64 % 100)
                    if now.Hour() == hour && now.Minute() == minute {
                        m.setImage(ctx, instance, int64(i))
                    }
                }
            }
        // ...
    }
}
```

**Issues:**
1. No initial image set on playlist start
2. User waits up to 1 minute before first image change
3. If starting at 10:30 AM with images at 8:00 AM and 2:00 PM, should show 8:00 AM image immediately
4. No binary search optimization

**Expected Behavior:** 
- On startup, find the most recent image time that has passed
- Set that image immediately
- Schedule next change based on next image time

---

### 3. **Time of Day - Missing calculateMillisecondsUntilNextImage()** 🔴 CRITICAL
**TypeScript Implementation:**
```typescript
timeOfDayPlayer() {
    const timeOut = this.calculateMillisecondsUntilNextImage();
    if (timeOut === undefined) {
        notify("Playlist internal error");
        return;
    }
    clearTimeout(this.playlistTimer.timeoutID);
    this.playlistTimer.timeoutID = setTimeout(() => {
        let newIndex = this.currentImageIndex + 1;
        if (newIndex === this.images.length) {
            newIndex = 0;
        }
        this.currentImageIndex = newIndex;
        void this.setImage(this.images[this.currentImageIndex]);
        this.timeOfDayPlayer(); // Recursive scheduling
    }, timeOut);
}

calculateMillisecondsUntilNextImage() {
    const nextIndex = this.currentImageIndex + 1 === this.images.length 
        ? 0 
        : this.currentImageIndex + 1;
    const nextTime = this.images[nextIndex].time;
    if (nextTime === null) return undefined;
    const date = new Date();
    const nowInMinutes = date.getHours() * 60 + date.getMinutes();
    let time = nextTime - nowInMinutes;
    if (time < 0) {
        time += 1440; // Add 24 hours if next image is tomorrow
    }
    time = 60 * time;
    time = time - date.getSeconds();
    time = time * 1000;
    return time;
}
```

**Go Implementation:**
- Uses 1-minute ticker, checks all images every minute
- Inefficient and imprecise

**Issues:**
1. Wastes CPU checking every minute
2. Can miss exact transition times if system is under load
3. No precise scheduling for next image

**Expected Behavior:**
- Calculate exact milliseconds until next image time
- Use single timer set to exact time
- Wrap around to next day if needed
- More efficient and precise

---

### 4. **Day of Week - No Initial Image Set** 🔴 CRITICAL
**TypeScript Implementation:**
```typescript
async dayOfWeekPlaylist() {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const millisecondsUntilEndOfDay = endOfDay.getTime() - now.getTime();
    
    let imageIndexToSet = now.getDay();
    if (imageIndexToSet > this.images.length) {
        imageIndexToSet = this.images.length - 1;
    }
    
    await this.setImage(this.images[imageIndexToSet]); // SET IMAGE IMMEDIATELY
    
    clearTimeout(this.playlistTimer.timeoutID);
    this.playlistTimer.timeoutID = setTimeout(() => {
        void this.dayOfWeekPlaylist(); // Recursive at midnight
    }, millisecondsUntilEndOfDay);
}
```

**Go Implementation:**
```go
func (m *Manager) runDayOfWeekPlaylist(ctx context.Context, instance *Instance) {
    ticker := time.NewTicker(1 * time.Minute)
    defer ticker.Stop()
    
    var lastDay time.Weekday = -1
    
    for {
        select {
        case now := <-ticker.C:
            if now.Weekday() != lastDay {
                dayIndex := int(now.Weekday())
                if dayIndex < len(instance.Playlist.Images) {
                    m.setImage(ctx, instance, int64(dayIndex))
                }
                lastDay = now.Weekday()
            }
        // ...
    }
}
```

**Issues:**
1. No initial image set when playlist starts
2. Uses inefficient 1-minute ticker instead of precise midnight timer
3. If playlist starts at 3 PM Monday, won't set Monday's image until Tuesday at midnight

**Expected Behavior:**
- Set current day's image immediately on start
- Calculate exact time until midnight
- Set single timer for midnight transition
- More efficient

---

### 5. **checkMissedEvents() - System Sleep Recovery** 🔴 CRITICAL
**TypeScript Implementation:**
```typescript
async checkMissedEvents() {
    clearTimeout(this.eventCheckerTimeout);
    this.eventCheckerTimeout = setInterval(() => {
        const now = Date.now();
        if (
            this.playlistTimer.executionTimeStamp === undefined ||
            now < this.playlistTimer.executionTimeStamp ||
            this.playlistTimer.timeoutID === undefined ||
            this.currentType === undefined
        ) {
            return;
        }
        // Execution time has passed but timer didn't fire - system was suspended
        clearTimeout(this.playlistTimer.timeoutID);
        switch (this.currentType) {
            case PLAYLIST_TYPES.TIME_OF_DAY:
                void this.timeOfDayPlaylist();
                break;
            case PLAYLIST_TYPES.DAY_OF_WEEK:
                void this.dayOfWeekPlaylist();
                break;
        }
    }, 10_000); // Check every 10 seconds
}
```

**Go Implementation:**
- **MISSING ENTIRELY**

**Impact:** 
- If user suspends laptop at 9 AM (showing morning image)
- Resumes at 3 PM (should show afternoon image)
- Time-of-day playlist won't update until next scheduled time (could be hours away)
- Day-of-week playlist won't update if resumed on same day

**Expected Behavior:**
- Periodically check if scheduled event was missed
- If current time > scheduled execution time, re-evaluate playlist
- Critical for laptops that sleep/suspend frequently

---

### 6. **Next/Previous Image - Missing Type Restrictions** 🟡 MEDIUM
**TypeScript Implementation:**
```typescript
async nextImage() {
    if (
        this.currentType === PLAYLIST_TYPES.DAY_OF_WEEK ||
        this.currentType === PLAYLIST_TYPES.TIME_OF_DAY
    ) {
        notify("Cannot change image in this type of playlist");
        return "Cannot change image in this type of playlist";
    }
    // ... proceed with next image
}
```

**Go Implementation:**
```go
func (m *Manager) NextImage(ctx context.Context, monitorName string) error {
    // No type check - allows next/previous on any playlist type
    m.nextImage(ctx, instance)
    return nil
}
```

**Issues:**
- Time-of-day playlists should not allow manual navigation (breaks the time-based logic)
- Day-of-week playlists should not allow manual navigation (breaks the day-based logic)
- User can manually skip ahead, breaking intended behavior

**Expected Behavior:**
- Return error for time-of-day and day-of-week playlists
- Only allow next/previous for timer and never playlists

---

### 7. **Timer Reset on Manual Navigation** 🟡 MEDIUM
**TypeScript Implementation:**
```typescript
async nextImage() {
    // ... validation ...
    this.currentImageIndex++;
    if (this.currentImageIndex === this.images.length) {
        this.currentImageIndex = 0;
    }
    if (this.currentType === PLAYLIST_TYPES.TIMER) {
        this.resetInterval(); // ← RESETS THE TIMER
    }
    await this.setImage(this.images[this.currentImageIndex]);
}

resetInterval() {
    clearTimeout(this.playlistTimer.timeoutID);
    this.playlistTimer.timeoutID = undefined;
    void this.timedPlaylist(); // Restart timer from now
}
```

**Go Implementation:**
```go
func (m *Manager) NextImage(ctx context.Context, monitorName string) error {
    m.mu.RLock()
    defer m.mu.RUnlock()
    
    instance, ok := m.instances[monitorName]
    if !ok {
        return errors.New(errors.SystemError, fmt.Sprintf("no playlist running on monitor %s", monitorName))
    }
    
    m.nextImage(ctx, instance) // Just advances, doesn't reset timer
    return nil
}
```

**Issues:**
- If timer is set to change every 5 minutes
- User manually advances at 2 minutes
- Next auto-change happens at 3 minutes (original 5-minute timer continues)
- Expected: Next auto-change should happen 5 minutes after manual change

**Expected Behavior:**
- When user manually navigates in timer playlist
- Reset the interval timer to start counting from now
- This provides predictable behavior

---

### 8. **Playlist Diagnostics - Missing** 🟢 LOW PRIORITY
**TypeScript Implementation:**
```typescript
async getPlaylistDiagnostics() {
    const previousIndex = this.currentImageIndex - 1 > 0 ? this.currentImageIndex - 1 : 0;
    const nextIndex = this.currentImageIndex + 1 === this.images.length ? 0 : this.currentImageIndex + 1;
    return {
        playlistName: this.name,
        playlistActiveMonitor: this.activeMonitor,
        showAnimations: this.showAnimations,
        type: this.currentType,
        playlistCurrentIndex: this.currentImageIndex,
        imagesNumber: this.images.length,
        currentImage: this.images[this.currentImageIndex],
        previousImage: this.images[previousIndex],
        nextImage: this.images[nextIndex],
        nextImageDueTime: new Date(this.playlistTimer.executionTimeStamp ?? 0),
        playlistInterval: this.interval
    };
}
```

**Go Implementation:**
- **MISSING** (no diagnostics API)

**Impact:**
- Harder to debug playlist issues
- No way to inspect playlist state
- Can't show "next image changes in X minutes" in UI

**Expected Behavior:**
- Add method to get current playlist state
- Return current/next/previous images
- Return time until next change
- Useful for debugging and UI display

---

## 🎯 Priority Matrix

| Priority | Feature | Impact | Complexity |
|----------|---------|--------|------------|
| **P0** | Never playlist initial set | High | Low |
| **P0** | Time-of-day findClosestImageIndex | High | Medium |
| **P0** | Time-of-day precise scheduling | High | Medium |
| **P0** | Day-of-week initial set | High | Low |
| **P0** | checkMissedEvents() | High | Medium |
| **P1** | Next/Previous restrictions | Medium | Low |
| **P1** | Timer reset on manual nav | Medium | Low |
| **P2** | Playlist diagnostics | Low | Low |

## 📝 Test Coverage Needed

### Unit Tests
- [ ] Never playlist sets image on start
- [ ] Time-of-day findClosestImageIndex with various scenarios
- [ ] Time-of-day calculates correct milliseconds until next image
- [ ] Time-of-day wraps around to next day correctly
- [ ] Day-of-week sets correct day image on start
- [ ] Day-of-week transitions at midnight
- [ ] Missed events detected after system suspend
- [ ] Next/Previous rejected for time-based playlists
- [ ] Timer resets on manual navigation
- [ ] Diagnostics returns accurate state

### Integration Tests
- [ ] Time-of-day playlist survives system suspend/resume
- [ ] Day-of-week playlist survives system suspend/resume  
- [ ] Multiple playlists on different monitors work independently
- [ ] Playlist state persists across daemon restart

## 🔧 Implementation Plan

1. **Phase 1: Critical Fixes (P0)**
   - Implement Never playlist image setting
   - Add findClosestImageIndex for time-of-day
   - Add precise scheduling for time-of-day
   - Add initial image set for day-of-week
   - Implement checkMissedEvents system

2. **Phase 2: Important Improvements (P1)**
   - Add type restrictions for next/previous
   - Implement timer reset on manual navigation

3. **Phase 3: Nice-to-Have (P2)**
   - Add playlist diagnostics API

## 🧪 TDD Approach

For each feature:
1. Write test describing expected behavior
2. Run test (should fail)
3. Implement minimum code to pass test
4. Refactor
5. Repeat

Use table-driven tests in Go for various scenarios.

