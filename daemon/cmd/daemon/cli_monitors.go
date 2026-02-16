package main

import (
	"github.com/spf13/cobra"
)

func buildMonitorsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "monitors",
		Short:   "List and inspect connected monitors",
		Aliases: []string{"mon"},
		RunE: func(cmd *cobra.Command, args []string) error {
			// Default action: list all monitors.
			return doSimpleRequest("GET", "/monitors")
		},
	}

	cmd.AddCommand(buildMonitorsGetCmd())

	return cmd
}

func buildMonitorsGetCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "get [name]",
		Short: "Get details for a specific monitor",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("GET", "/monitors/"+args[0])
		},
	}
}
