package main

import (
	"fmt"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
)

func buildImagesCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "images",
		Short: "Manage images in the gallery",
		Long:  "List, add, delete, update, rename, and inspect images managed by the daemon.",
	}

	cmd.AddCommand(buildImagesListCmd())
	cmd.AddCommand(buildImagesGetCmd())
	cmd.AddCommand(buildImagesAddCmd())
	cmd.AddCommand(buildImagesImportCmd())
	cmd.AddCommand(buildImagesDeleteCmd())
	cmd.AddCommand(buildImagesCountCmd())
	cmd.AddCommand(buildImagesHistoryCmd())
	cmd.AddCommand(buildImagesTagsCmd())
	cmd.AddCommand(buildImagesUpdateCmd())
	cmd.AddCommand(buildImagesRenameCmd())
	cmd.AddCommand(buildImagesCancelImportCmd())

	return cmd
}

func buildImagesListCmd() *cobra.Command {
	var page int
	var perPage int
	var search string
	var sortBy string
	var sortOrder string
	var mediaType string

	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List images in the gallery",
		Aliases: []string{"ls"},
		RunE: func(cmd *cobra.Command, args []string) error {
			params := []string{}
			if page > 0 {
				params = append(params, fmt.Sprintf("page=%d", page))
			}
			if perPage > 0 {
				params = append(params, fmt.Sprintf("per_page=%d", perPage))
			}
			if search != "" {
				params = append(params, "search="+search)
			}
			if sortBy != "" {
				params = append(params, "sort_by="+sortBy)
			}
			if sortOrder != "" {
				params = append(params, "sort_order="+sortOrder)
			}
			if mediaType != "" {
				params = append(params, "media_type="+mediaType)
			}

			path := "/images"
			if len(params) > 0 {
				path += "?" + strings.Join(params, "&")
			}

			return doSimpleRequest("GET", path)
		},
	}

	cmd.Flags().IntVarP(&page, "page", "p", 1, "page number")
	cmd.Flags().IntVarP(&perPage, "per-page", "n", 50, "items per page")
	cmd.Flags().StringVarP(&search, "search", "s", "", "search filter")
	cmd.Flags().StringVar(&sortBy, "sort-by", "", "sort field (name, created_at, updated_at)")
	cmd.Flags().StringVar(&sortOrder, "sort-order", "", "sort order (asc, desc)")
	cmd.Flags().StringVar(&mediaType, "media-type", "", "filter by media type")

	return cmd
}

func buildImagesGetCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "get [id]",
		Short: "Get details for a specific image",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("GET", "/images/"+args[0])
		},
	}
}

func buildImagesAddCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "add [paths...]",
		Short: "Add images to the gallery by file path",
		Long: `Add one or more images to the gallery. The daemon will process them
asynchronously (copy to cache, generate thumbnails, extract metadata).`,
		Args: cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			body := map[string]any{
				"paths": args,
			}
			return doJSONRequest("POST", "/images", body)
		},
	}
}

func buildImagesImportCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "import [paths...]",
		Short: "Import images with shell glob expansion",
		Long: `Import one or more images into the gallery. Glob patterns like *.jpg
are resolved to absolute paths before sending to the daemon.`,
		Args: cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			var resolved []string
			for _, pattern := range args {
				matches, err := filepath.Glob(pattern)
				if err != nil {
					return fmt.Errorf("invalid glob pattern %q: %w", pattern, err)
				}
				if len(matches) == 0 {
					abs, err := filepath.Abs(pattern)
					if err != nil {
						return fmt.Errorf("cannot resolve path %q: %w", pattern, err)
					}
					resolved = append(resolved, abs)
					continue
				}
				for _, m := range matches {
					abs, err := filepath.Abs(m)
					if err != nil {
						return fmt.Errorf("cannot resolve path %q: %w", m, err)
					}
					resolved = append(resolved, abs)
				}
			}
			body := map[string]any{
				"paths": resolved,
			}
			return doJSONRequest("POST", "/images", body)
		},
	}
}

func buildImagesDeleteCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "delete [ids...]",
		Short:   "Delete images from the gallery by ID",
		Aliases: []string{"rm"},
		Args:    cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			ids := make([]int, 0, len(args))
			for _, arg := range args {
				id, err := strconv.Atoi(arg)
				if err != nil {
					return fmt.Errorf("invalid image ID %q: %w", arg, err)
				}
				ids = append(ids, id)
			}
			body := map[string]any{
				"ids": ids,
			}
			return doJSONRequest("DELETE", "/images", body)
		},
	}
}

func buildImagesCountCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "count",
		Short: "Show the total number of images in the gallery",
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("GET", "/images/count")
		},
	}
}

func buildImagesHistoryCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "history",
		Short: "Wallpaper change history",
		Long:  "View or clear wallpaper change history.",
	}

	cmd.AddCommand(buildImagesHistoryListCmd())
	cmd.AddCommand(buildImagesHistoryClearCmd())

	// Default to listing when run without a subcommand.
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		return cmd.Help()
	}

	return cmd
}

func buildImagesHistoryListCmd() *cobra.Command {
	var limit int
	var monitorName string

	cmd := &cobra.Command{
		Use:     "list",
		Short:   "Show wallpaper change history",
		Aliases: []string{"ls"},
		RunE: func(cmd *cobra.Command, args []string) error {
			params := []string{}
			if limit > 0 {
				params = append(params, fmt.Sprintf("limit=%d", limit))
			}
			if monitorName != "" {
				params = append(params, "monitor="+monitorName)
			}

			path := "/images/history"
			if len(params) > 0 {
				path += "?" + strings.Join(params, "&")
			}

			return doSimpleRequest("GET", path)
		},
	}

	cmd.Flags().IntVarP(&limit, "limit", "n", 20, "maximum number of entries to show")
	cmd.Flags().StringVarP(&monitorName, "monitor", "m", "", "filter by monitor name")

	return cmd
}

func buildImagesHistoryClearCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "clear",
		Short: "Clear wallpaper change history",
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("DELETE", "/images/history")
		},
	}
}

func buildImagesTagsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "tags",
		Short: "List all unique image tags",
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("GET", "/images/tags")
		},
	}
}

func buildImagesUpdateCmd() *cobra.Command {
	var tags string
	var colors string

	cmd := &cobra.Command{
		Use:   "update [id]",
		Short: "Update image metadata",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			body := map[string]any{}
			if cmd.Flags().Changed("tags") {
				body["tags"] = splitCSV(tags)
			}
			if cmd.Flags().Changed("colors") {
				body["colors"] = splitCSV(colors)
			}
			if len(body) == 0 {
				return fmt.Errorf("at least one of --tags or --colors must be specified")
			}
			return doJSONRequest("PATCH", "/images/"+args[0], body)
		},
	}

	cmd.Flags().StringVar(&tags, "tags", "", "comma-separated tags")
	cmd.Flags().StringVar(&colors, "colors", "", "comma-separated colors")

	return cmd
}

func buildImagesRenameCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "rename [id] [new-name]",
		Short: "Rename an image",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			body := map[string]any{
				"name": args[1],
			}
			return doJSONRequest("POST", "/images/"+args[0]+"/rename", body)
		},
	}
}

func buildImagesCancelImportCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "cancel-import [batch-id]",
		Short: "Cancel a running image import batch",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			body := map[string]any{
				"batch_id": args[0],
			}
			return doJSONRequest("POST", "/images/cancel-import", body)
		},
	}
}

func splitCSV(s string) []string {
	var result []string
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}
