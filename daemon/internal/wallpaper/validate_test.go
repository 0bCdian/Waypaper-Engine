package wallpaper_test

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/testutil"
	"waypaper-engine/daemon/internal/wallpaper"
)

// helpers

func makeBackend(kinds ...backend.ContentKind) *testutil.MockBackend {
	return &testutil.MockBackend{
		NameFn: func() string { return "test-backend" },
		CapabilitiesFn: func() backend.Capabilities {
			return backend.Capabilities{ContentKinds: kinds}
		},
	}
}

func makeImageStore(img *store.Image, err error) *testutil.MockImageStore {
	return &testutil.MockImageStore{
		GetByIDFn: func(_ context.Context, _ int) (*store.Image, error) {
			return img, err
		},
	}
}

func connectedMap(names ...string) map[string]monitor.Monitor {
	m := make(map[string]monitor.Monitor, len(names))
	for _, n := range names {
		m[n] = monitor.Monitor{Name: n}
	}
	return m
}

func staticImage() *store.Image { return &store.Image{ID: 1, MediaType: "image"} }
func videoImage() *store.Image  { return &store.Image{ID: 2, MediaType: "video"} }
func gifImage() *store.Image    { return &store.Image{ID: 3, MediaType: "gif"} }
func webImage() *store.Image    { return &store.Image{ID: 4, MediaType: "web"} }

// tests

func TestValidateApplyRequest(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name      string
		req       wallpaper.ApplyRequest
		backend   *testutil.MockBackend
		images    *testutil.MockImageStore
		connected map[string]monitor.Monitor
		wantErr   error // nil means no error expected; checked with errors.Is
		wantNil   bool  // true when wantErr==nil and we expect success
	}{
		{
			name:      "empty monitors -> ErrTargetEmpty",
			req:       wallpaper.ApplyRequest{ImageID: 1, Monitors: nil, Mode: backend.ModeClone},
			backend:   makeBackend(backend.KindStaticImage),
			images:    makeImageStore(staticImage(), nil),
			connected: connectedMap("DP-1"),
			wantErr:   wallpaper.ErrTargetEmpty,
		},
		{
			name:      "monitor not connected -> ErrMonitorNotConnected",
			req:       wallpaper.ApplyRequest{ImageID: 1, Monitors: []string{"HDMI-1"}, Mode: backend.ModeClone},
			backend:   makeBackend(backend.KindStaticImage),
			images:    makeImageStore(staticImage(), nil),
			connected: connectedMap("DP-1"),
			wantErr:   wallpaper.ErrMonitorNotConnected,
		},
		{
			name:      "image not found -> ErrImageNotFound",
			req:       wallpaper.ApplyRequest{ImageID: 99, Monitors: []string{"DP-1"}, Mode: backend.ModeClone},
			backend:   makeBackend(backend.KindStaticImage),
			images:    makeImageStore(nil, store.ErrNotFound),
			connected: connectedMap("DP-1"),
			wantErr:   wallpaper.ErrImageNotFound,
		},
		{
			name:      "infrastructure error propagated unwrapped",
			req:       wallpaper.ApplyRequest{ImageID: 1, Monitors: []string{"DP-1"}, Mode: backend.ModeClone},
			backend:   makeBackend(backend.KindStaticImage),
			images:    makeImageStore(nil, fmt.Errorf("db timeout")),
			connected: connectedMap("DP-1"),
			wantErr:   fmt.Errorf("db timeout"), // checked by string, not errors.Is
		},
		{
			name:      "video image, backend only supports static -> ErrContentKindUnsupported",
			req:       wallpaper.ApplyRequest{ImageID: 2, Monitors: []string{"DP-1"}, Mode: backend.ModeClone},
			backend:   makeBackend(backend.KindStaticImage),
			images:    makeImageStore(videoImage(), nil),
			connected: connectedMap("DP-1"),
			wantErr:   wallpaper.ErrContentKindUnsupported,
		},
		{
			name:      "video image, backend supports video, clone mode -> nil",
			req:       wallpaper.ApplyRequest{ImageID: 2, Monitors: []string{"DP-1"}, Mode: backend.ModeClone},
			backend:   makeBackend(backend.KindStaticImage, backend.KindVideo),
			images:    makeImageStore(videoImage(), nil),
			connected: connectedMap("DP-1"),
			wantNil:   true,
		},
		{
			name:      "static image, extend mode -> nil",
			req:       wallpaper.ApplyRequest{ImageID: 1, Monitors: []string{"DP-1", "HDMI-1"}, Mode: backend.ModeExtend},
			backend:   makeBackend(backend.KindStaticImage),
			images:    makeImageStore(staticImage(), nil),
			connected: connectedMap("DP-1", "HDMI-1"),
			wantNil:   true,
		},
		{
			name:      "video image, extend mode -> ErrExtendNotSupported",
			req:       wallpaper.ApplyRequest{ImageID: 2, Monitors: []string{"DP-1", "HDMI-1"}, Mode: backend.ModeExtend},
			backend:   makeBackend(backend.KindStaticImage, backend.KindVideo),
			images:    makeImageStore(videoImage(), nil),
			connected: connectedMap("DP-1", "HDMI-1"),
			wantErr:   wallpaper.ErrExtendNotSupported,
		},
		{
			name:      "gif image, extend mode -> ErrExtendNotSupported",
			req:       wallpaper.ApplyRequest{ImageID: 3, Monitors: []string{"DP-1", "HDMI-1"}, Mode: backend.ModeExtend},
			backend:   makeBackend(backend.KindStaticImage, backend.KindGIF),
			images:    makeImageStore(gifImage(), nil),
			connected: connectedMap("DP-1", "HDMI-1"),
			wantErr:   wallpaper.ErrExtendNotSupported,
		},
		{
			name:      "web image, clone mode, backend supports web -> nil",
			req:       wallpaper.ApplyRequest{ImageID: 4, Monitors: []string{"DP-1"}, Mode: backend.ModeClone},
			backend:   makeBackend(backend.KindStaticImage, backend.KindWebWallpaper),
			images:    makeImageStore(webImage(), nil),
			connected: connectedMap("DP-1"),
			wantNil:   true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := wallpaper.ValidateApplyRequest(ctx, tc.req, tc.backend, tc.images, tc.connected)

			if tc.wantNil {
				if err != nil {
					t.Fatalf("expected nil error, got: %v", err)
				}
				return
			}

			if err == nil {
				t.Fatalf("expected error wrapping %v, got nil", tc.wantErr)
			}

			// For the infra-error propagation case, just check message substring.
			if tc.name == "infrastructure error propagated unwrapped" {
				if err.Error() != "db timeout" {
					t.Fatalf("expected %q, got %q", "db timeout", err.Error())
				}
				return
			}

			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("expected errors.Is(%v), got: %v", tc.wantErr, err)
			}
		})
	}
}
