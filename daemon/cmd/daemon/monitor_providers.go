package main

import (
	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/walqt"
	"waypaper-engine/daemon/internal/monitor"
)

func defaultMonitorProviders(v backend.ConfigReader) []monitor.MonitorProvider {
	return []monitor.MonitorProvider{
		monitor.NewWaylandProvider(),
		walqt.NewMonitorProvider(v),
		monitor.NewWaylandLegacyProvider(),
		monitor.NewXrandrProvider(),
	}
}
