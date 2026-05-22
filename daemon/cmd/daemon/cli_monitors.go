package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"waypaper-engine/daemon/internal/monitor"
)

// monitorsDirect, when true, makes the `monitors` subcommands query monitor
// providers in-process instead of going through the daemon's HTTP API.
// Useful for diagnosing provider issues without restarting the daemon.
var monitorsDirect bool

func buildMonitorsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "monitors",
		Short:   "List and inspect connected monitors",
		Aliases: []string{"mon"},
		RunE: func(cmd *cobra.Command, args []string) error {
			if monitorsDirect {
				return runMonitorsDirect("")
			}
			return doSimpleRequest("GET", "/monitors")
		},
	}

	cmd.PersistentFlags().BoolVar(&monitorsDirect, "direct", false,
		"query monitor providers in-process instead of via the daemon socket (diagnostic)")

	cmd.AddCommand(buildMonitorsGetCmd())

	return cmd
}

func buildMonitorsGetCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "get [name]",
		Short: "Get details for a specific monitor",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if monitorsDirect {
				return runMonitorsDirect(args[0])
			}
			return doSimpleRequest("GET", "/monitors/"+args[0])
		},
	}
}

// runMonitorsDirect bypasses the daemon socket and queries the provider chain
// directly. The provider list mirrors the running daemon's wiring, so output
// is the same shape — just without requiring a daemon process. Config from
// disk is not loaded, so wal-qt uses default control-socket settings.
func runMonitorsDirect(name string) error {
	mgr, err := monitor.NewMonitorManager(defaultMonitorProviders(nil), "")
	if err != nil {
		return fmt.Errorf("monitor manager: %w", err)
	}

	ctx := context.Background()

	if name != "" {
		mon, err := mgr.GetMonitorByName(ctx, name)
		if err != nil {
			return err
		}
		return writeJSON(mon)
	}

	mons, err := mgr.GetMonitors(ctx)
	if err != nil {
		return err
	}
	return writeJSON(mons)
}

func writeJSON(v any) error {
	enc := json.NewEncoder(os.Stdout)
	if !jsonOutput {
		enc.SetIndent("", "  ")
	}
	return enc.Encode(v)
}
