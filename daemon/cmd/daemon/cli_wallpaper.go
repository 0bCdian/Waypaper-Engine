package main

import (
	"fmt"
	"strconv"

	"github.com/spf13/cobra"
)

func buildWallpaperCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "wallpaper",
		Short:   "Wallpaper commands",
		Aliases: []string{"wp"},
		Long:    "View current wallpaper and change wallpapers by ID or randomly.",
	}

	cmd.AddCommand(buildWallpaperCurrentCmd())
	cmd.AddCommand(buildWallpaperSetCmd())
	cmd.AddCommand(buildWallpaperRandomCmd())
	cmd.AddCommand(buildWallpaperNextCmd())
	cmd.AddCommand(buildWallpaperPreviousCmd())

	return cmd
}

func buildWallpaperCurrentCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "current",
		Short: "Show the current wallpaper for each monitor",
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("GET", "/wallpaper/current")
		},
	}
}

func buildWallpaperSetCmd() *cobra.Command {
	var monitorName string
	var mode string

	cmd := &cobra.Command{
		Use:   "set [image-id]",
		Short: "Set a wallpaper by image ID",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := strconv.Atoi(args[0])
			if err != nil {
				return fmt.Errorf("invalid image ID %q: %w", args[0], err)
			}
			body := map[string]any{
				"image_id": id,
				"monitor":  monitorName,
				"mode":     mode,
			}
			return doJSONRequest("POST", "/wallpaper/set", body)
		},
	}

	cmd.Flags().StringVarP(&monitorName, "monitor", "m", "*", "target monitor name (* for all)")
	cmd.Flags().StringVar(&mode, "mode", "individual", "monitor mode (individual, clone, extend)")

	return cmd
}

func buildWallpaperRandomCmd() *cobra.Command {
	var monitorName string
	var mode string

	cmd := &cobra.Command{
		Use:   "random",
		Short: "Set a random wallpaper",
		RunE: func(cmd *cobra.Command, args []string) error {
			body := map[string]any{
				"monitor": monitorName,
				"mode":    mode,
			}
			return doJSONRequest("POST", "/wallpaper/random", body)
		},
	}

	cmd.Flags().StringVarP(&monitorName, "monitor", "m", "*", "target monitor name (* for all)")
	cmd.Flags().StringVar(&mode, "mode", "individual", "monitor mode (individual, clone, extend)")

	return cmd
}

func buildWallpaperNextCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "next",
		Short: "Go to next wallpaper in history",
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/wallpaper/history/next")
		},
	}
}

func buildWallpaperPreviousCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "previous",
		Short:   "Go to previous wallpaper in history",
		Aliases: []string{"prev"},
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/wallpaper/history/previous")
		},
	}
}
