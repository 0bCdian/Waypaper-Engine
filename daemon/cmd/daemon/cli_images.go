package main

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
)

func buildImagesCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "images",
		Short: "Manage images in the gallery",
		Long:  "List, add, delete, and inspect images managed by the daemon.",
	}

	cmd.AddCommand(buildImagesListCmd())
	cmd.AddCommand(buildImagesGetCmd())
	cmd.AddCommand(buildImagesAddCmd())
	cmd.AddCommand(buildImagesDeleteCmd())
	cmd.AddCommand(buildImagesCountCmd())
	cmd.AddCommand(buildImagesHistoryCmd())

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
		Use:   "list",
		Short: "List images in the gallery",
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

func buildImagesDeleteCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "delete [ids...]",
		Short: "Delete images from the gallery by ID",
		Aliases: []string{"rm"},
		Args: cobra.MinimumNArgs(1),
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
	var limit int
	var monitorName string

	cmd := &cobra.Command{
		Use:   "history",
		Short: "Show wallpaper change history",
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
