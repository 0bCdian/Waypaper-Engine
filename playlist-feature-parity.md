# Playlist Feature Parity Analysis: TypeScript Daemon vs Go Daemon

## Executive Summary
The Go daemon has **most** playlist features implemented but is **MISSING the save_playlist IPC handler**, which is critical for saving playlists from the frontend.

---

## ✅ Features with Full Parity

### Core Playlist Operations
| Feature | TypeScript Daemon | Go Daemon | Status |
|---------|-------------------|-----------|--------|
| **Start Playlist** | ✓ `START_PLAYLIST` | ✓ `start_playlist` | ✅ Complete |
| **Stop Playlist** | ✓ `STOP_PLAYLIST` | ✓ `stop_playlist` | ✅ Complete |
| **Pause Playlist** | ✓ `PAUSE_PLAYLIST` | ✓ `pause_playlist` | ✅ Complete |
| **Resume Playlist** | ✓ `RESUME_PLAYLIST` | ✓ `resume_playlist` | ✅ Complete |
| **Next Image** | ✓ `NEXT_IMAGE` | ✓ `next_image` | ✅ Complete |
| **Previous Image** | ✓ `PREVIOUS_IMAGE` | ✓ `previous_image` | ✅ Complete |
| **Random Image** | ✓ `RANDOM_IMAGE` | ✓ `random_image` | ✅ Complete |
| **Set Image** | ✓ `SET_IMAGE` | ✓ `set_image` | ✅ Complete |

### Playlist Types Support
| Type | TypeScript Daemon | Go Daemon | Status |
|------|-------------------|-----------|--------|
| **Timer** | ✓ `timedPlaylist()` | ✓ `runTimerPlaylist()` | ✅ Complete |
| **Never** | ✓ `neverPlaylist()` | ✓ Handled in `runPlaylist()` | ✅ Complete |
| **Time of Day** | ✓ `timeOfDayPlaylist()` | ✓ `runTimeOfDayPlaylist()` | ✅ Complete |
| **Day of Week** | ✓ `dayOfWeekPlaylist()` | ✓ `runDayOfWeekPlaylist()` | ✅ Complete |

### Bulk Operations
| Feature | TypeScript Daemon | Go Daemon | Status |
|---------|-------------------|-----------|--------|
| **Next Image All** | ✓ `NEXT_IMAGE_ALL` | ✓ `next_image_all` | ✅ Complete |
| **Previous Image All** | ✓ `PREVIOUS_IMAGE_ALL` | ✓ `previous_image_all` | ✅ Complete |
| **Stop Playlist All** | ✓ `STOP_PLAYLIST_ALL` | ✓ `stop_playlist_all` | ✅ Complete |
| **Pause Playlist All** | ✓ `PAUSE_PLAYLIST_ALL` | ✓ `pause_playlist_all` | ✅ Complete |
| **Resume Playlist All** | ✓ `RESUME_PLAYLIST_ALL` | ✓ `resume_playlist_all` | ✅ Complete |

### Info/Query Operations
| Feature | TypeScript Daemon | Go Daemon | Status |
|---------|-------------------|-----------|--------|
| **Get Info** | ✓ `GET_INFO` | ✓ `get_info` | ✅ Complete |
| **Get Active Playlist Info** | ✓ `GET_INFO_ACTIVE_PLAYLIST` | ✓ `get_active_playlist` | ✅ Complete |
| **Get Playlists** | ✓ DB query | ✓ `get_playlists` | ✅ Complete |
| **Get Playlist Images** | ✓ DB query | ✓ `get_playlist_images` | ✅ Complete |

### System Operations
| Feature | TypeScript Daemon | Go Daemon | Status |
|---------|-------------------|-----------|--------|
| **Stop on Removed Displays** | ✓ `STOP_PLAYLIST_ON_REMOVED_DISPLAYS` | ✓ Handled in screen listeners | ✅ Complete |
| **Update Config** | ✓ `UPDATE_CONFIG` | ✓ `update_config` | ✅ Complete |

---

## ❌ CRITICAL MISSING FEATURE

### Save Playlist (Upsert)

**TypeScript Daemon:**
```typescript
// electron/main.ts
ipcMain.on("savePlaylist", (_, playlistObject: rendererPlaylist) => {
    savePlaylist(playlistObject);
    void createTray();
});

// database/dbOperations.ts
async upsertPlaylist(playlistObject: rendererPlaylist) {
    const { images, ...playlist } = playlistObject;
    // Insert/update playlist and its images
}
```

**Go Daemon:**
- ✅ **Database operation EXISTS**: `UpsertPlaylistWithImages()` in `daemon-go/internal/db/operations.go:361-398`
- ❌ **IPC handler MISSING**: No `save_playlist` or `upsert_playlist` handler in `daemon-go/internal/ipc/handler.go`

**Impact:** Users **cannot save playlists** from the frontend. This is a **blocking issue**.

---

## 🔧 Required Implementation

### 1. Add IPC Handler in `daemon-go/internal/ipc/handler.go`

```go
// In HandleMessage switch statement (around line 72)
case "save_playlist":
    response = h.handleSavePlaylist(msg)
```

### 2. Implement Handler Function

```go
func (h *Handler) handleSavePlaylist(msg *Message) *Response {
    ctx := context.Background()
    
    // Validate input
    if msg.Playlist == nil {
        return &Response{
            Action: msg.Action, 
            Error: errors.New(errors.IPCError, "playlist data is required").Error(),
        }
    }
    
    // Convert frontend playlist to database playlist
    playlist := db.Playlist{
        Name:                    msg.Playlist.Name,
        Type:                    msg.Playlist.Configuration.Type,
        Interval:                msg.Playlist.Configuration.Interval,
        Showanimations:          boolToInt64(msg.Playlist.Configuration.ShowAnimations),
        Alwaysstartonfirstimage: boolToInt64(msg.Playlist.Configuration.AlwaysStartOnFirstImage),
        Order:                   msg.Playlist.Configuration.Order,
        Currentimageindex:       msg.Playlist.Configuration.CurrentImageIndex,
    }
    
    // Convert images
    images := make([]db.Image, len(msg.Playlist.Images))
    for i, img := range msg.Playlist.Images {
        images[i] = db.Image{ID: img.ID}
    }
    
    // Save to database
    playlistID, err := h.dbOps.UpsertPlaylistWithImages(ctx, playlist, images)
    if err != nil {
        h.logger.Error("failed to save playlist", "error", err)
        return &Response{Action: msg.Action, Error: err.Error()}
    }
    
    h.logger.Info("playlist saved successfully", "name", playlist.Name, "id", playlistID)
    return &Response{Action: msg.Action, Data: map[string]interface{}{"id": playlistID}}
}
```

### 3. Update Protocol in `daemon-go/internal/ipc/protocol.go`

Add `Playlist` field to the `Message` struct if not already present:

```go
type Message struct {
    // ... existing fields ...
    Playlist *RendererPlaylist `json:"playlist,omitempty"`
}

type RendererPlaylist struct {
    Name          string                `json:"name"`
    Images        []RendererImage       `json:"images"`
    Configuration PlaylistConfiguration `json:"configuration"`
    ActiveMonitor *ActiveMonitor        `json:"activeMonitor,omitempty"`
}

type PlaylistConfiguration struct {
    Type                    string `json:"type"`
    Interval                *int64 `json:"interval,omitempty"`
    ShowAnimations          bool   `json:"showAnimations"`
    AlwaysStartOnFirstImage bool   `json:"alwaysStartOnFirstImage"`
    Order                   string `json:"order,omitempty"`
    CurrentImageIndex       int64  `json:"currentImageIndex"`
}
```

### 4. Update `goDaemonClient.ts`

Add method to client:

```typescript
async savePlaylist(playlist: rendererPlaylist): Promise<any> {
    return this.sendCommand("save_playlist", { playlist });
}
```

---

## 📊 Implementation Priority

| Priority | Feature | Reason |
|----------|---------|--------|
| **P0 - Critical** | `save_playlist` IPC handler | **Blocks core functionality** - users can't save playlists |
| P1 - High | Delete playlist handler | Already present: `delete_playlist` |
| P2 - Medium | Update playlist name/metadata | Can workaround by re-saving |
| P3 - Low | Playlist diagnostics | Nice-to-have for debugging |

---

## ✅ Advanced Features Present in Go Daemon (Not in TS)

The Go daemon actually has **additional features** not present in the TypeScript daemon:

1. **Better monitor handling**: `set_image_across_monitors`, `duplicate_image_across_monitors`
2. **Real-time image processing**: Event-driven image processing
3. **Batch operations**: Better support for bulk image operations
4. **Configuration management**: More structured config handling
5. **Image metadata**: Enhanced metadata tracking

---

## 🎯 Conclusion

**Overall Status:** 95% feature parity ✅

**Critical Gap:** Missing `save_playlist` IPC handler ❌

**Recommendation:** 
1. Implement the `save_playlist` handler immediately (estimated: 1-2 hours)
2. Test with existing frontend integration
3. Verify playlist save/load workflow end-to-end

The database layer is ready, the playlist manager is complete, and the only missing piece is the IPC bridge between the frontend and the backend.

