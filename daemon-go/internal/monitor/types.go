package monitor

// CompositorType represents the type of compositor
type CompositorType string

const (
	CompositorTypeAuto    CompositorType = "auto"
	CompositorTypeX11     CompositorType = "x11"
	CompositorTypeWayland CompositorType = "wayland"
)

// CompositorInfo contains information about the compositor
type CompositorInfo struct {
	Type CompositorType
}

// Position represents a 2D position
type Position struct {
	X int
	Y int
}

// Monitor represents a display monitor
type Monitor struct {
	Name         string
	Width        int
	Height       int
	CurrentImage string
	Position     Position
}

// Monitors is a map of monitor name to Monitor
type Monitors map[string]Monitor

// MonitorMode represents how monitors are used
type MonitorMode string

const (
	MonitorModeExtend MonitorMode = "extend"
	MonitorModeClone  MonitorMode = "clone"
)

// MonitorSelection represents selected monitors and their mode
type MonitorSelection struct {
	ID       string
	Monitors []Monitor
	Mode     MonitorMode
}

// MonitorManager interface for monitor detection and management
type MonitorManager interface {
	GetMonitors() Monitors
	GetMonitorByName(name string) (Monitor, bool)
	GetPrimaryMonitor() (Monitor, bool)
	GetCompositorInfo() *CompositorInfo
	Start() error
	Stop()
}
