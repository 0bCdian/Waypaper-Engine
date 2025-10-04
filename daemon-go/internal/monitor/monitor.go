
package monitor

// Position represents the x, y coordinates of a monitor.
type Position struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// Monitor represents a single display.
type Monitor struct {
	Name         string   `json:"name"`
	Width        int      `json:"width"`
	Height       int      `json:"height"`
	CurrentImage string   `json:"currentImage"`
	Position     Position `json:"position"`
}

// ActiveMonitor represents the currently active monitor setup.
type ActiveMonitor struct {
	Name                 string    `json:"name"`
	Monitors             []Monitor `json:"monitors"`
	ExtendAcrossMonitors bool      `json:"extendAcrossMonitors"`
}
