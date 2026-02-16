package main

import (
	"github.com/spf13/cobra"
)

func buildPlaylistCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "playlist",
		Short:   "Manage playlists",
		Aliases: []string{"pl"},
		Long:    "List, inspect, and control playlists on the daemon.",
	}

	cmd.AddCommand(buildPlaylistListCmd())
	cmd.AddCommand(buildPlaylistGetCmd())
	cmd.AddCommand(buildPlaylistStartCmd())
	cmd.AddCommand(buildPlaylistStopCmd())
	cmd.AddCommand(buildPlaylistPauseCmd())
	cmd.AddCommand(buildPlaylistResumeCmd())
	cmd.AddCommand(buildPlaylistNextCmd())
	cmd.AddCommand(buildPlaylistPrevCmd())
	cmd.AddCommand(buildPlaylistActiveCmd())
	cmd.AddCommand(buildPlaylistStopAllCmd())
	cmd.AddCommand(buildPlaylistPauseAllCmd())
	cmd.AddCommand(buildPlaylistResumeAllCmd())
	cmd.AddCommand(buildPlaylistNextAllCmd())
	cmd.AddCommand(buildPlaylistPrevAllCmd())

	return cmd
}

func buildPlaylistListCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "list",
		Short:   "List all playlists",
		Aliases: []string{"ls"},
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("GET", "/playlists")
		},
	}
}

func buildPlaylistGetCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "get [id]",
		Short: "Get details for a specific playlist",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("GET", "/playlists/"+args[0])
		},
	}
}

func buildPlaylistStartCmd() *cobra.Command {
	var monitorID string
	var mode string

	cmd := &cobra.Command{
		Use:   "start [id]",
		Short: "Start a playlist",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			body := map[string]any{
				"monitor": map[string]any{
					"id":   monitorID,
					"mode": mode,
				},
			}
			return doJSONRequest("POST", "/playlists/"+args[0]+"/start", body)
		},
	}

	cmd.Flags().StringVarP(&monitorID, "monitor", "m", "*", "target monitor ID (* for all)")
	cmd.Flags().StringVar(&mode, "mode", "individual", "monitor mode (individual, clone, extend)")

	return cmd
}

func buildPlaylistStopCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "stop [id]",
		Short: "Stop a running playlist",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/playlists/"+args[0]+"/stop")
		},
	}
}

func buildPlaylistPauseCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "pause [id]",
		Short: "Pause a running playlist",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/playlists/"+args[0]+"/pause")
		},
	}
}

func buildPlaylistResumeCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "resume [id]",
		Short: "Resume a paused playlist",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/playlists/"+args[0]+"/resume")
		},
	}
}

func buildPlaylistNextCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "next [id]",
		Short: "Advance to next image in a playlist",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/playlists/"+args[0]+"/next")
		},
	}
}

func buildPlaylistPrevCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "prev [id]",
		Short:   "Go back to previous image in a playlist",
		Aliases: []string{"previous"},
		Args:    cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/playlists/"+args[0]+"/previous")
		},
	}
}

func buildPlaylistActiveCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "active",
		Short: "List all active (running) playlists",
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("GET", "/playlists/active")
		},
	}
}

func buildPlaylistStopAllCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "stop-all",
		Short: "Stop all running playlists",
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/playlists/active/stop")
		},
	}
}

func buildPlaylistPauseAllCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "pause-all",
		Short: "Pause all running playlists",
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/playlists/active/pause")
		},
	}
}

func buildPlaylistResumeAllCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "resume-all",
		Short: "Resume all paused playlists",
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/playlists/active/resume")
		},
	}
}

func buildPlaylistNextAllCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "next-all",
		Short: "Advance all running playlists to next image",
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/playlists/active/next")
		},
	}
}

func buildPlaylistPrevAllCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "prev-all",
		Short:   "Reverse all running playlists to previous image",
		Aliases: []string{"previous-all"},
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/playlists/active/previous")
		},
	}
}
