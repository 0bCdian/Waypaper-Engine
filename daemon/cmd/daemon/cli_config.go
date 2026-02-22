package main

import (
	"strings"

	"github.com/spf13/cobra"
)

func buildConfigCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "View and manage daemon configuration",
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("GET", "/config")
		},
	}

	cmd.AddCommand(buildConfigGetCmd())
	cmd.AddCommand(buildConfigSetCmd())

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

func buildConfigSetCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "set [section] [json-body]",
		Short: "Update a config section with a JSON patch",
		Long: `Patch a config section with a raw JSON object.

Example:
  waypaper-daemon config set daemon '{"log_level":"debug"}'`,
		Args: cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			resp, err := doRequest("PATCH", "/config/"+args[0], strings.NewReader(args[1]))
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			if err := checkResponse(resp); err != nil {
				return err
			}
			printJSON(resp.Body)
			return nil
		},
	}
}
