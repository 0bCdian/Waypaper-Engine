package wallpaper

import (
	"context"
	"errors"
	"fmt"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

// Typed errors for the apply request validation pipeline.
var (
	ErrImageNotFound          = errors.New("wallpaper: image not found")
	ErrTargetEmpty            = errors.New("wallpaper: target has no monitors")
	ErrMonitorNotConnected    = errors.New("wallpaper: target monitor not connected")
	ErrContentKindUnsupported = errors.New("wallpaper: backend does not support content kind")
	ErrExtendNotSupported     = errors.New("wallpaper: extend mode requires static image content")
)

// ApplyRequest is the input to ValidateApplyRequest. The HTTP handler
// populates this from the parsed JSON body.
type ApplyRequest struct {
	ImageID  int
	Monitors []string     // target monitor names
	Mode     backend.Mode // Clone | Extend (Single is Clone with len==1)
}

// ValidateApplyRequest runs sequential checks against current state.
// Returns the first typed error encountered, or nil if the request is sound.
// No DB writes. No snapshot built. Pure read-side validation.
func ValidateApplyRequest(
	ctx context.Context,
	req ApplyRequest,
	activeBackend backend.Backend,
	images store.ImageStore,
	connected map[string]monitor.Monitor,
) error {
	// 1. Target non-empty.
	if len(req.Monitors) == 0 {
		return ErrTargetEmpty
	}

	// 2. Every target monitor is connected.
	for _, name := range req.Monitors {
		if _, ok := connected[name]; !ok {
			return fmt.Errorf("%w: %s", ErrMonitorNotConnected, name)
		}
	}

	// 3. Image exists.
	img, err := images.GetByID(ctx, req.ImageID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return fmt.Errorf("%w: id=%d", ErrImageNotFound, req.ImageID)
		}
		return err // infrastructure failure — propagate
	}

	// 4. Backend supports the content kind.
	kind := mediaTypeToKind(img.MediaType)
	caps := activeBackend.Capabilities()
	if !supportsKind(caps, kind) {
		return fmt.Errorf("%w: kind=%s backend=%s", ErrContentKindUnsupported, kind, activeBackend.Name())
	}

	// 5. Extend mode requires static image kind.
	if req.Mode == backend.ModeExtend && kind != backend.KindStaticImage {
		return fmt.Errorf("%w: kind=%s", ErrExtendNotSupported, kind)
	}

	return nil
}
