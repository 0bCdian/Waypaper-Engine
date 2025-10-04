package system

import (
	"context"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/monitor"
)

// Info holds system information.
type Info struct {
	Monitors     []monitor.Monitor
	AppConfig    interface{}
	SwwwConfig   interface{}
	ImageHistory []db.GetImageHistoryRow
}

// GetInfo returns system information.
func GetInfo(ctx context.Context, dbOps *db.DatabaseOperations) (*Info, error) {
	monitorManager := monitor.NewSwwwManager(&monitor.SwwwCommandRunner{})
	monitors, err := monitorManager.GetMonitors()
	if err != nil {
		return nil, err
	}

	appConfig, err := dbOps.GetOrCreateAppConfig(ctx, nil)
	if err != nil {
		return nil, err
	}

	swwwConfig, err := dbOps.GetOrCreateSwwwConfig(ctx, nil)
	if err != nil {
		return nil, err
	}

	imageHistory, err := dbOps.GetImageHistory(ctx, 50) // Use default limit for system info
	if err != nil {
		return nil, err
	}

	return &Info{
		Monitors:     monitors,
		AppConfig:    appConfig,
		SwwwConfig:   swwwConfig,
		ImageHistory: imageHistory,
	}, nil
}
