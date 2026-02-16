package main

import (
	"github.com/spf13/cobra"
)

func buildConfigCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "View and manage daemon configuration",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Default action: show full config.
			return doSimpleRequest("GET", "/config")
		},
	}

	cmd.AddCommand(buildConfigGetCmd())

	return cmd
}

func buildConfigGetCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "get [section]",
		Short: "Get a specific config section (e.g. daemon, app, backend)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("GET", "/config/"+args[0])
		},
	}
}
