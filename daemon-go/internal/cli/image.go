package cli

import (
	"fmt"
	"os"
	"path/filepath"

	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/ipc"
	"waypaper-engine/daemon-go/internal/models"

	"github.com/spf13/cobra"
)

var imageCmd = &cobra.Command{
	Use:   "image",
	Short: "Manage images",
}

var randomImageCmd = &cobra.Command{
	Use:   "random [monitor_name]",
	Short: "Set a random image on a monitor",
	Args:  cobra.ExactArgs(1),
	Run:   runImageCmd,
}

func init() {
	rootCmd.AddCommand(imageCmd)
	imageCmd.AddCommand(randomImageCmd)
}

func runImageCmd(cmd *cobra.Command, args []string) {
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

	msg, err := buildImageMessage(cmd.Name(), args)
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

	switch action {
	case "random":
		msg.ActiveMonitor = &models.ActiveMonitor{Name: args[0]}
	default:
		return nil, fmt.Errorf("unknown image action: %s", action)
	}

	return msg, nil
}
