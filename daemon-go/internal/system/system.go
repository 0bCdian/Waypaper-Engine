package system

import (
	"context"

	"waypaper-engine/daemon-go/internal/monitor"
	"waypaper-engine/daemon-go/internal/store"
)

// Info holds system information.
type Info struct {
	Monitors     []monitor.Monitor
	AppConfig    interface{}
	SwwwConfig   interface{}
	ImageHistory []store.ImageHistoryEntry
}

// GetInfo returns system information.
func GetInfo(ctx context.Context, jsonStore *store.JsonStoreManager) (*Info, error) {
	monitorManager := monitor.NewSwwwManager(&monitor.SwwwCommandRunner{})
	monitors, err := monitorManager.GetMonitors()
	if err != nil {
		return nil, err
	}

	appConfig, err := jsonStore.GetAppConfig(ctx)
	if err != nil {
		return nil, err
	}

	swwwConfig, err := jsonStore.GetSwwwConfig(ctx)
	if err != nil {
		return nil, err
	}

	imageHistory, err := jsonStore.GetImageHistory(ctx, 50) // Use default limit for system info
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
