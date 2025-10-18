package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/ipc"
	"waypaper-engine/daemon-go/internal/models"

	"github.com/spf13/cobra"
)

var imageCmd = &cobra.Command{
	Use:   "image",
	Short: "Manage images",
}

var setImageCmd = &cobra.Command{
	Use:   "set [image_id]",
	Short: "Set a specific image",
	Args:  cobra.ExactArgs(1),
	Run:   runSetImageCmd,
}

var randomImageCmd = &cobra.Command{
	Use:   "random",
	Short: "Set a random image",
	Run:   runRandomImageCmd,
}

var (
	monitorsFlag   string
	extendFlag     bool
	cloneFlag      bool
	individualFlag bool
)

func init() {
	rootCmd.AddCommand(imageCmd)
	imageCmd.AddCommand(setImageCmd)
	imageCmd.AddCommand(randomImageCmd)

	// Add flags for monitor configuration
	setImageCmd.Flags().StringVarP(&monitorsFlag, "monitors", "m", "", "Comma-separated list of monitor names (default: all monitors)")
	setImageCmd.Flags().BoolVar(&extendFlag, "extend", false, "Extend image across monitors")
	setImageCmd.Flags().BoolVar(&cloneFlag, "clone", false, "Clone image on all monitors (default)")
	setImageCmd.Flags().BoolVar(&individualFlag, "individual", false, "Set image on individual monitors")

	randomImageCmd.Flags().StringVarP(&monitorsFlag, "monitors", "m", "", "Comma-separated list of monitor names (default: all monitors)")
	randomImageCmd.Flags().BoolVar(&extendFlag, "extend", false, "Extend image across monitors")
	randomImageCmd.Flags().BoolVar(&cloneFlag, "clone", false, "Clone image on all monitors (default)")
	randomImageCmd.Flags().BoolVar(&individualFlag, "individual", false, "Set image on individual monitors")
}

func runSetImageCmd(cmd *cobra.Command, args []string) {
	runImageCmd("set_image", args)
}

func runRandomImageCmd(cmd *cobra.Command, args []string) {
	runImageCmd("random_image", args)
}

func runImageCmd(action string, args []string) {
	// Get socket path from config
	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Printf("Failed to get home directory: %v\n", err)
		return
	}
	configPath := filepath.Join(homeDir, ".config", "waypaper-engine", "config.toml")
	configManager := config.NewConfigManager(configPath)
	socketPath, err := configManager.GetSocketPath()
	if err != nil {
		fmt.Printf("Failed to get socket path: %v\n", err)
		return
	}

	client, err := ipc.NewClient(socketPath)
	if err != nil {
		fmt.Printf("Failed to connect to daemon: %v\n", err)
		return
	}
	defer client.Close()

	msg, err := buildImageMessage(action, args)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}

	resp, err := client.Send(msg)
	if err != nil {
		fmt.Printf("Failed to send message: %v\n", err)
		return
	}

	if resp.Error != "" {
		fmt.Printf("Error: %s\n", resp.Error)
	} else {
		fmt.Println(resp.Data)
	}
}

func buildImageMessage(action string, args []string) (*ipc.Message, error) {
	msg := &ipc.Message{Action: action}

	// Default behavior: if no monitors specified, assume all monitors
	var monitorNames []string
	if monitorsFlag == "" {
		// Query all available monitors from the daemon
		// For now, we'll use a default set - in a real implementation,
		// this would query the daemon for available monitors
		monitorNames = []string{"DP-1", "HDMI-1"} // Default monitors
	} else {
		// Parse monitor names from flag
		monitorNames = strings.Split(monitorsFlag, ",")
		for i, name := range monitorNames {
			monitorNames[i] = strings.TrimSpace(name)
		}
	}

	// Default behavior: if no mode specified, assume clone
	var extendAcrossMonitors bool
	modeCount := 0
	if extendFlag {
		modeCount++
	}
	if cloneFlag {
		modeCount++
	}
	if individualFlag {
		modeCount++
	}

	if modeCount == 0 {
		// Default to clone mode
		extendAcrossMonitors = true
	} else if modeCount > 1 {
		return nil, fmt.Errorf("cannot specify multiple modes. Choose one: --extend, --clone, or --individual")
	} else {
		// Determine mode from flags
		if extendFlag {
			extendAcrossMonitors = true
		} else if cloneFlag {
			extendAcrossMonitors = true // Clone is also extend across monitors
		} else {
			extendAcrossMonitors = false // Individual mode
		}
	}

	// Create monitor list
	monitors := make([]models.Monitor, len(monitorNames))
	for i, name := range monitorNames {
		monitors[i] = models.Monitor{
			Name:   name,
			Width:  1920, // Default resolution - could be queried from system
			Height: 1080,
			Position: struct {
				X int `json:"x"`
				Y int `json:"y"`
			}{
				X: i * 1920, // Simple positioning
				Y: 0,
			},
		}
	}

	// Create active monitor configuration
	activeMonitor := &models.ActiveMonitor{
		Name:     strings.Join(monitorNames, ","),
		Monitors: monitors,
		ImageSetType: func() string {
			if extendAcrossMonitors {
				return "extend"
			}
			return "clone"
		}(),
	}

	switch action {
	case "set_image":
		// Parse image ID
		imageID, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid image ID: %s", args[0])
		}
		msg.Image = &ipc.ImageInfo{ID: imageID}
		msg.ActiveMonitor = activeMonitor

	case "random_image":
		msg.ActiveMonitor = activeMonitor

	default:
		return nil, fmt.Errorf("unknown image action: %s", action)
	}

	return msg, nil
}
