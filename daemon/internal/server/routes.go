package server

import (
	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/handler/backendshandler"
	"waypaper-engine/daemon/internal/handler/confighandler"
	"waypaper-engine/daemon/internal/handler/foldershandler"
	"waypaper-engine/daemon/internal/handler/healthhandler"
	"waypaper-engine/daemon/internal/handler/imageshandler"
	"waypaper-engine/daemon/internal/handler/monitorshandler"
	"waypaper-engine/daemon/internal/handler/playlistshandler"
	"waypaper-engine/daemon/internal/handler/themeshandler"
	"waypaper-engine/daemon/internal/handler/wallpaperhandler"
)

// Handlers bundles all handler instances for route registration.
type Handlers struct {
	Health    *healthhandler.HealthHandler
	Images    *imageshandler.ImageHandler
	Playlists *playlistshandler.PlaylistHandler
	Monitors  *monitorshandler.MonitorHandler
	Config    *confighandler.ConfigHandler
	Backends  *backendshandler.BackendHandler
	Wallpaper *wallpaperhandler.WallpaperHandler
	Folders   *foldershandler.FolderHandler
	Themes    *themeshandler.ThemesHandler

	// BackendReady closes once the backend is initialized and the startup restore is done;
	// routes that change what is on screen wait for it. Nil means always ready.
	BackendReady <-chan struct{}
}

// NewRouter creates a chi router with all routes and middleware registered.
func NewRouter(h Handlers, bus events.Bus) *chi.Mux {
	r := chi.NewRouter()
	gated := RequireReady(h.BackendReady)

	// Global middleware.
	r.Use(RequestID)
	r.Use(Logger)
	r.Use(Recoverer)

	// Health endpoints.
	r.Get("/healthz", h.Health.Healthz)
	r.Get("/info", h.Health.Info)
	r.Get("/capabilities", h.Health.Capabilities)
	r.Post("/shutdown", h.Health.Shutdown)

	// SSE events endpoint.
	r.Get("/events", NewSSEBroker(bus).ServeHTTP)

	// Images.
	r.Route("/images", func(r chi.Router) {
		r.Get("/", h.Images.List)
		r.Post("/", h.Images.Add)
		r.Post("/import-web", h.Images.ImportWeb)
		r.Delete("/", h.Images.Delete)
		r.Get("/tags", h.Images.Tags)
		r.Get("/history", h.Wallpaper.GetHistory)
		r.Delete("/history", h.Wallpaper.ClearHistory)
		r.Post("/cancel-import", h.Images.CancelImport)
		r.Post("/select-all", h.Images.SelectAll)
		r.Post("/{id}/ensure-browser-preview", h.Images.EnsureBrowserPreview)
		r.Post("/{id}/video-loop-export", h.Images.VideoLoopExport)
		r.Post("/{id}/extract-video-palette", h.Images.ExtractVideoPalette)
		r.Get("/{id}", h.Images.Get)
		r.Patch("/{id}", h.Images.Update)
		r.Get("/{id}/thumbnail", h.Images.Thumbnail)
		r.Get("/{id}/raw", h.Images.RawImage)
	})

	// Playlists.
	r.Route("/playlists", func(r chi.Router) {
		r.Get("/", h.Playlists.List)
		r.Post("/", h.Playlists.Create)

		// Bulk active-playlist actions (must be before /{id} to avoid chi conflict).
		r.Get("/active", h.Playlists.ListActive)
		r.Get("/active/{monitor}", h.Playlists.GetActiveByMonitor)
		r.With(gated).Post("/active/stop", h.Playlists.StopAll)
		r.With(gated).Post("/active/pause", h.Playlists.PauseAll)
		r.With(gated).Post("/active/resume", h.Playlists.ResumeAll)
		r.With(gated).Post("/active/next", h.Playlists.NextAll)
		r.With(gated).Post("/active/previous", h.Playlists.PreviousAll)

		r.Get("/{id}", h.Playlists.Get)
		r.Patch("/{id}", h.Playlists.Update)
		r.Delete("/{id}", h.Playlists.Delete)
		r.With(gated).Post("/{id}/start", h.Playlists.Start)
		r.With(gated).Post("/{id}/stop", h.Playlists.Stop)
		r.With(gated).Post("/{id}/pause", h.Playlists.Pause)
		r.With(gated).Post("/{id}/resume", h.Playlists.Resume)
		r.With(gated).Post("/{id}/next", h.Playlists.Next)
		r.With(gated).Post("/{id}/previous", h.Playlists.Previous)
	})

	// Folders.
	r.Route("/folders", func(r chi.Router) {
		r.Get("/", h.Folders.List)
		r.Post("/", h.Folders.Create)
		r.Post("/move-images", h.Folders.MoveImages)
		r.Get("/{id}", h.Folders.Get)
		r.Patch("/{id}", h.Folders.Update)
		r.Delete("/{id}", h.Folders.Delete)
		r.Get("/{id}/path", h.Folders.GetPath)
	})

	// Monitors.
	r.Route("/monitors", func(r chi.Router) {
		r.Get("/", h.Monitors.List)
		r.Get("/{name}", h.Monitors.Get)
	})

	// Config.
	r.Route("/config", func(r chi.Router) {
		r.Get("/", h.Config.GetConfig)
		r.Patch("/", h.Config.PatchConfig)
		r.With(gated).Post("/reset", h.Config.PostResetAll)
		r.Get("/backends/{backend}", h.Config.GetNamedBackendConfig)
		r.With(gated).Post("/backends/{backend}/reset", h.Config.PostResetNamedBackendConfig)
		r.With(gated).Patch("/backends/{backend}", h.Config.PatchNamedBackendConfig)
		r.Get("/{section}", h.Config.GetSection)
		r.Patch("/{section}", h.Config.PatchSection)
	})

	// Backends.
	r.Route("/backends", func(r chi.Router) {
		r.Get("/", h.Backends.List)
		r.With(gated).Post("/{name}/activate", h.Backends.Activate)
	})

	// Wallpaper.
	r.Route("/wallpaper", func(r chi.Router) {
		r.Get("/current", h.Wallpaper.GetCurrent)
		r.With(gated).Post("/set", h.Wallpaper.Set)
		r.With(gated).Post("/random", h.Wallpaper.Random)
	})

	// User themes (drop-in CSS palettes from ~/.config/waypaper-engine/themes/).
	// Register on the root mux: under a nested Route, chi matches GET "/api/themes/" for
	// r.Get("/") but not GET "/api/themes" (no trailing slash), which yields 404 for the renderer.
	if h.Themes != nil {
		r.Get("/api/themes", h.Themes.List)
		r.Get("/api/themes/{name}.css", h.Themes.Get)
	}

	return r
}
