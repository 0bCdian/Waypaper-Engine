package main

import (
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
)

// resolvePlaylistID fetches all playlists and finds the one matching the given
// name, returning its ID as a string. Returns an error if no match is found.
func resolvePlaylistID(name string) (string, error) {
	resp, err := doRequest("GET", "/playlists", nil)
	if err != nil {
		return "", fmt.Errorf("failed to list playlists: %w", err)
	}
	defer resp.Body.Close()
	if err := checkResponse(resp); err != nil {
		return "", err
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read playlists response: %w", err)
	}

	var playlists []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(data, &playlists); err != nil {
		return "", fmt.Errorf("failed to parse playlists: %w", err)
	}

	for _, p := range playlists {
		if strings.EqualFold(p.Name, name) {
			return strconv.Itoa(p.ID), nil
		}
	}
	return "", fmt.Errorf("no playlist found with name %q", name)
}

// resolvePlaylistArg returns the playlist ID from either the --name flag or
// the first positional argument. Returns an error if neither is provided.
func resolvePlaylistArg(cmd *cobra.Command, args []string) (string, error) {
	name, _ := cmd.Flags().GetString("name")
	if name != "" {
		return resolvePlaylistID(name)
	}
	if len(args) < 1 {
		return "", fmt.Errorf("playlist ID argument or --name flag is required")
	}
	return args[0], nil
}

// addPlaylistNameFlag adds a --name flag as an alternative to the positional ID arg.
func addPlaylistNameFlag(cmd *cobra.Command) {
	cmd.Flags().StringP("name", "N", "", "playlist name (alternative to ID)")
}

func buildPlaylistCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "playlist",
		Short:   "Manage playlists",
		Aliases: []string{"pl"},
		Long:    "List, inspect, create, update, delete, and control playlists on the daemon.",
	}

	cmd.AddCommand(buildPlaylistListCmd())
	cmd.AddCommand(buildPlaylistGetCmd())
	cmd.AddCommand(buildPlaylistCreateCmd())
	cmd.AddCommand(buildPlaylistUpdateCmd())
	cmd.AddCommand(buildPlaylistDeleteCmd())
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
	cmd := &cobra.Command{
		Use:   "get [id]",
		Short: "Get details for a specific playlist",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := resolvePlaylistArg(cmd, args)
			if err != nil {
				return err
			}
			return doSimpleRequest("GET", "/playlists/"+id)
		},
	}
	addPlaylistNameFlag(cmd)
	return cmd
}

func buildPlaylistCreateCmd() *cobra.Command {
	var playlistType string
	var interval int
	var order string

	cmd := &cobra.Command{
		Use:   "create [name]",
		Short: "Create a new playlist",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			body := map[string]any{
				"name": args[0],
			}
			if cmd.Flags().Changed("type") {
				body["type"] = playlistType
			}
			if cmd.Flags().Changed("interval") {
				body["interval"] = interval
			}
			if cmd.Flags().Changed("order") {
				body["order"] = order
			}
			return doJSONRequest("POST", "/playlists", body)
		},
	}

	cmd.Flags().StringVar(&playlistType, "type", "", "playlist type (timer, manual, time_of_day, day_of_week)")
	cmd.Flags().IntVar(&interval, "interval", 0, "interval in seconds (for timer type)")
	cmd.Flags().StringVar(&order, "order", "", "playback order (ordered, random)")

	return cmd
}

func buildPlaylistUpdateCmd() *cobra.Command {
	var name string
	var playlistType string
	var interval int
	var order string
	var addImages string
	var removeImages string

	cmd := &cobra.Command{
		Use:   "update [id]",
		Short: "Update a playlist",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := resolvePlaylistArg(cmd, args)
			if err != nil {
				return err
			}
			body := map[string]any{}
			if cmd.Flags().Changed("playlist-name") {
				body["name"] = name
			}
			if cmd.Flags().Changed("type") {
				body["type"] = playlistType
			}
			if cmd.Flags().Changed("interval") {
				body["interval"] = interval
			}
			if cmd.Flags().Changed("order") {
				body["order"] = order
			}
			if addImages != "" {
				body["add_images"] = parseIntList(addImages)
			}
			if removeImages != "" {
				body["remove_images"] = parseIntList(removeImages)
			}
			if len(body) == 0 {
				return fmt.Errorf("at least one update flag must be specified")
			}
			return doJSONRequest("PATCH", "/playlists/"+id, body)
		},
	}

	addPlaylistNameFlag(cmd)
	cmd.Flags().StringVar(&name, "playlist-name", "", "new playlist name")
	cmd.Flags().StringVar(&playlistType, "type", "", "playlist type (timer, manual, time_of_day, day_of_week)")
	cmd.Flags().IntVar(&interval, "interval", 0, "interval in seconds")
	cmd.Flags().StringVar(&order, "order", "", "playback order (ordered, random)")
	cmd.Flags().StringVar(&addImages, "add-images", "", "comma-separated image IDs to add")
	cmd.Flags().StringVar(&removeImages, "remove-images", "", "comma-separated image IDs to remove")

	return cmd
}

func buildPlaylistDeleteCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "delete [id]",
		Short:   "Delete a playlist",
		Aliases: []string{"rm"},
		Args:    cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := resolvePlaylistArg(cmd, args)
			if err != nil {
				return err
			}
			return doSimpleRequest("DELETE", "/playlists/"+id)
		},
	}
	addPlaylistNameFlag(cmd)
	return cmd
}

func buildPlaylistStartCmd() *cobra.Command {
	var monitorID string
	var mode string

	cmd := &cobra.Command{
		Use:   "start [id]",
		Short: "Start a playlist",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := resolvePlaylistArg(cmd, args)
			if err != nil {
				return err
			}
			body := map[string]any{
				"monitor": map[string]any{
					"id":   monitorID,
					"mode": mode,
				},
			}
			return doJSONRequest("POST", "/playlists/"+id+"/start", body)
		},
	}

	addPlaylistNameFlag(cmd)
	cmd.Flags().StringVarP(&monitorID, "monitor", "m", "*", "target monitor ID (* for all)")
	cmd.Flags().StringVar(&mode, "mode", "individual", "monitor mode (individual, clone, extend)")

	return cmd
}

func buildPlaylistStopCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "stop [id]",
		Short: "Stop a running playlist",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := resolvePlaylistArg(cmd, args)
			if err != nil {
				return err
			}
			return doSimpleRequest("POST", "/playlists/"+id+"/stop")
		},
	}
	addPlaylistNameFlag(cmd)
	return cmd
}

func buildPlaylistPauseCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "pause [id]",
		Short: "Pause a running playlist",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := resolvePlaylistArg(cmd, args)
			if err != nil {
				return err
			}
			return doSimpleRequest("POST", "/playlists/"+id+"/pause")
		},
	}
	addPlaylistNameFlag(cmd)
	return cmd
}

func buildPlaylistResumeCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "resume [id]",
		Short: "Resume a paused playlist",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := resolvePlaylistArg(cmd, args)
			if err != nil {
				return err
			}
			return doSimpleRequest("POST", "/playlists/"+id+"/resume")
		},
	}
	addPlaylistNameFlag(cmd)
	return cmd
}

func buildPlaylistNextCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "next [id]",
		Short: "Advance to next image in a playlist",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := resolvePlaylistArg(cmd, args)
			if err != nil {
				return err
			}
			return doSimpleRequest("POST", "/playlists/"+id+"/next")
		},
	}
	addPlaylistNameFlag(cmd)
	return cmd
}

func buildPlaylistPrevCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "prev [id]",
		Short:   "Go back to previous image in a playlist",
		Aliases: []string{"previous"},
		Args:    cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := resolvePlaylistArg(cmd, args)
			if err != nil {
				return err
			}
			return doSimpleRequest("POST", "/playlists/"+id+"/previous")
		},
	}
	addPlaylistNameFlag(cmd)
	return cmd
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

// parseIntList splits a comma-separated string into a slice of ints,
// silently skipping empty segments.
func parseIntList(s string) []int {
	var result []int
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if n, err := strconv.Atoi(part); err == nil {
			result = append(result, n)
		}
	}
	return result
}
