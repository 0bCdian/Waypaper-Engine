package main

import (
	"github.com/spf13/viper"

	"waypaper-engine/daemon/internal/backend/walqt"
	"waypaper-engine/daemon/internal/monitor"
)

// defaultMonitorProviders builds the standard monitor-provider chain used by
// both the running daemon and the `monitors --direct` diagnostic. v may be
// nil when called from `--direct` without a loaded config — utauri falls back
// to its default control-socket path in that case.
//
// Evaluation order on Wayland (by priority): native zwlr_output_management first,
// then wal-qt HTTP status (subset topology), then legacy randr-style probes.
func defaultMonitorProviders(v *viper.Viper) []monitor.MonitorProvider {
	return []monitor.MonitorProvider{
		monitor.NewWaylandProvider(),
		walqt.NewMonitorProvider(v),
		monitor.NewWaylandLegacyProvider(),
		monitor.NewXrandrProvider(),
	}
}
