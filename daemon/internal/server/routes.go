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
}

// NewRouter creates a chi router with all routes and middleware registered.
func NewRouter(h Handlers, bus events.Bus) *chi.Mux {
	r := chi.NewRouter()

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
		r.Get("/count", h.Images.Count)
		r.Get("/tags", h.Images.Tags)
		r.Get("/history", h.Wallpaper.GetHistory)
		r.Delete("/history", h.Wallpaper.ClearHistory)
		r.Post("/cancel-import", h.Images.CancelImport)
		r.Post("/select-all", h.Images.SelectAll)
		r.Post("/{id}/ensure-browser-preview", h.Images.EnsureBrowserPreview)
		r.Post("/{id}/video-loop-export", h.Images.VideoLoopExport)
		r.Get("/{id}", h.Images.Get)
		r.Patch("/{id}", h.Images.Update)
		r.Post("/{id}/rename", h.Images.RenameImage)
		r.Get("/{id}/thumbnail", h.Images.Thumbnail)
		r.Get("/{id}/thumbnail/raw", h.Images.RawThumbnail)
		r.Get("/{id}/raw", h.Images.RawImage)
	})

	// Playlists.
	r.Route("/playlists", func(r chi.Router) {
		r.Get("/", h.Playlists.List)
		r.Post("/", h.Playlists.Create)

		// Bulk active-playlist actions (must be before /{id} to avoid chi conflict).
		r.Get("/active", h.Playlists.ListActive)
		r.Get("/active/{monitor}", h.Playlists.GetActiveByMonitor)
		r.Post("/active/stop", h.Playlists.StopAll)
		r.Post("/active/pause", h.Playlists.PauseAll)
		r.Post("/active/resume", h.Playlists.ResumeAll)
		r.Post("/active/next", h.Playlists.NextAll)
		r.Post("/active/previous", h.Playlists.PreviousAll)

		r.Get("/{id}", h.Playlists.Get)
		r.Patch("/{id}", h.Playlists.Update)
		r.Delete("/{id}", h.Playlists.Delete)
		r.Post("/{id}/start", h.Playlists.Start)
		r.Post("/{id}/stop", h.Playlists.Stop)
		r.Post("/{id}/pause", h.Playlists.Pause)
		r.Post("/{id}/resume", h.Playlists.Resume)
		r.Post("/{id}/next", h.Playlists.Next)
		r.Post("/{id}/previous", h.Playlists.Previous)
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
		r.Get("/backends/{backend}", h.Config.GetNamedBackendConfig)
		r.Patch("/backends/{backend}", h.Config.PatchNamedBackendConfig)
		r.Get("/{section}", h.Config.GetSection)
		r.Patch("/{section}", h.Config.PatchSection)
	})

	// Backends.
	r.Route("/backends", func(r chi.Router) {
		r.Get("/", h.Backends.List)
		r.Post("/{name}/activate", h.Backends.Activate)
	})

	// Wallpaper.
	r.Route("/wallpaper", func(r chi.Router) {
		r.Get("/current", h.Wallpaper.GetCurrent)
		r.Post("/set", h.Wallpaper.Set)
		r.Post("/random", h.Wallpaper.Random)
	})

	return r
}
