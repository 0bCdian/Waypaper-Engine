package main

import (
	"github.com/spf13/cobra"
)

func buildBackendsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "backends",
		Short: "List and manage wallpaper backends",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Default action: list all backends.
			return doSimpleRequest("GET", "/backends")
		},
	}

	cmd.AddCommand(buildBackendsActivateCmd())

	return cmd
}

func buildBackendsActivateCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "activate [name]",
		Short: "Activate a wallpaper backend (e.g. awww, feh, hyprpaper)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/backends/"+args[0]+"/activate")
		},
	}
}
