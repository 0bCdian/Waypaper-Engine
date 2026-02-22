package main

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
)

func buildFoldersCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "folders",
		Short: "Manage image folders",
		Long:  "List, create, update, delete, and navigate image folders.",
	}

	cmd.AddCommand(buildFoldersListCmd())
	cmd.AddCommand(buildFoldersGetCmd())
	cmd.AddCommand(buildFoldersCreateCmd())
	cmd.AddCommand(buildFoldersUpdateCmd())
	cmd.AddCommand(buildFoldersDeleteCmd())
	cmd.AddCommand(buildFoldersPathCmd())
	cmd.AddCommand(buildFoldersMoveImagesCmd())

	return cmd
}

func buildFoldersListCmd() *cobra.Command {
	var parentID string

	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List all folders",
		Aliases: []string{"ls"},
		RunE: func(cmd *cobra.Command, args []string) error {
			path := "/folders"
			if parentID != "" {
				path += "?parent_id=" + parentID
			}
			return doSimpleRequest("GET", path)
		},
	}

	cmd.Flags().StringVar(&parentID, "parent-id", "", "filter by parent folder ID")

	return cmd
}

func buildFoldersGetCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "get [id]",
		Short: "Get details for a specific folder",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("GET", "/folders/"+args[0])
		},
	}
}

func buildFoldersCreateCmd() *cobra.Command {
	var parentID int

	cmd := &cobra.Command{
		Use:   "create [name]",
		Short: "Create a new folder",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			body := map[string]any{
				"name": args[0],
			}
			if cmd.Flags().Changed("parent-id") {
				body["parent_id"] = parentID
			}
			return doJSONRequest("POST", "/folders", body)
		},
	}

	cmd.Flags().IntVar(&parentID, "parent-id", 0, "parent folder ID")

	return cmd
}

func buildFoldersUpdateCmd() *cobra.Command {
	var name string
	var parentID int

	cmd := &cobra.Command{
		Use:   "update [id]",
		Short: "Update a folder",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			body := map[string]any{}
			if cmd.Flags().Changed("name") {
				body["name"] = name
			}
			if cmd.Flags().Changed("parent-id") {
				body["parent_id"] = parentID
			}
			if len(body) == 0 {
				return fmt.Errorf("at least one of --name or --parent-id must be specified")
			}
			return doJSONRequest("PATCH", "/folders/"+args[0], body)
		},
	}

	cmd.Flags().StringVar(&name, "name", "", "new folder name")
	cmd.Flags().IntVar(&parentID, "parent-id", 0, "new parent folder ID")

	return cmd
}

func buildFoldersDeleteCmd() *cobra.Command {
	var mode string

	cmd := &cobra.Command{
		Use:     "delete [id]",
		Short:   "Delete a folder",
		Aliases: []string{"rm"},
		Args:    cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			body := map[string]any{}
			if mode != "" {
				body["mode"] = mode
			}
			return doJSONRequest("DELETE", "/folders/"+args[0], body)
		},
	}

	cmd.Flags().StringVar(&mode, "mode", "", "deletion mode (keep_contents, delete_all)")

	return cmd
}

func buildFoldersPathCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "path [id]",
		Short: "Show the breadcrumb path for a folder",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("GET", "/folders/"+args[0]+"/path")
		},
	}
}

func buildFoldersMoveImagesCmd() *cobra.Command {
	var imageIDs string
	var folderID int

	cmd := &cobra.Command{
		Use:   "move-images",
		Short: "Move images to a folder",
		RunE: func(cmd *cobra.Command, args []string) error {
			if imageIDs == "" {
				return fmt.Errorf("--image-ids is required")
			}
			ids := []int{}
			for _, s := range strings.Split(imageIDs, ",") {
				s = strings.TrimSpace(s)
				if s == "" {
					continue
				}
				id, err := strconv.Atoi(s)
				if err != nil {
					return fmt.Errorf("invalid image ID %q: %w", s, err)
				}
				ids = append(ids, id)
			}
			body := map[string]any{
				"image_ids": ids,
				"folder_id": folderID,
			}
			return doJSONRequest("POST", "/folders/move-images", body)
		},
	}

	cmd.Flags().StringVar(&imageIDs, "image-ids", "", "comma-separated image IDs to move")
	cmd.Flags().IntVar(&folderID, "folder-id", 0, "target folder ID")
	_ = cmd.MarkFlagRequired("folder-id")

	return cmd
}
