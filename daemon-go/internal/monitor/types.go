package monitor

// CompositorType defines supported compositor types
type CompositorType string

const (
	CompositorTypeAuto    CompositorType = "auto"
	CompositorTypeX11     CompositorType = "x11"
	CompositorTypeWayland CompositorType = "wayland"
)

// CompositorInfo contains information about the current compositor
type CompositorInfo struct {
	Type CompositorType `toml:"type" json:"type"`
}

type Position struct {
	X int `json:"x"`
	Y int `json:"y"`
}
type Monitor struct {
	Name         string   `json:"name"`
	Width        int      `json:"width"`
	Height       int      `json:"height"`
	CurrentImage string   `json:"currentImage"`
	Position     Position `json:"position"`
}

type Monitors map[string]Monitor

// MonitorManager interface defines the contract for monitor management
type MonitorManager interface {
	GetMonitors() Monitors

	GetMonitorByName(name string) (Monitor, bool)

	Start() error

	Stop()

	Events() <-chan MonitorEvent
}

// MonitorMode defines how monitors are configured
type MonitorMode string

const (
	MonitorModeIndividual MonitorMode = "individual"
	MonitorModeExtend     MonitorMode = "extend"
	MonitorModeClone      MonitorMode = "clone"
)

// MonitorEvent represents a change in monitor configuration
type MonitorEvent struct {
	Type    string  `json:"type"` // "added", "removed", "changed"
	Monitor Monitor `json:"monitor"`
}

type MonitorSelection struct {
	ID       string      `toml:"id" json:"id"`
	Monitors []Monitor   `toml:"monitors" json:"monitors"`
	Mode     MonitorMode `toml:"mode" json:"mode"` // "individual", "extend", or "clone"
}

// MonitorImagePair represents a monitor and its associated image path
type MonitorImagePair struct {
	Monitor Monitor `toml:"monitor" json:"monitor"`
	Image   string  `toml:"image" json:"image"`
}
