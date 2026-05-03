package main

import (
	"github.com/spf13/viper"

	"waypaper-engine/daemon/internal/backend/waylandutauri"
	"waypaper-engine/daemon/internal/monitor"
)

// defaultMonitorProviders builds the standard monitor-provider chain used by
// both the running daemon and the `monitors --direct` diagnostic. v may be
// nil when called from `--direct` without a loaded config — utauri falls back
// to its default control-socket path in that case.
func defaultMonitorProviders(v *viper.Viper) []monitor.MonitorProvider {
	return []monitor.MonitorProvider{
		waylandutauri.NewMonitorProvider(v),
		monitor.NewWaylandProvider(),
		monitor.NewWaylandLegacyProvider(),
		monitor.NewXrandrProvider(),
	}
}
