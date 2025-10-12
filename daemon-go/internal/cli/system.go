package cli

import (
	"fmt"
	"os"
	"path/filepath"

	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/ipc"

	"github.com/spf13/cobra"
)

var systemCmd = &cobra.Command{
	Use:   "system",
	Short: "Manage system settings",
}

var infoCmd = &cobra.Command{
	Use:   "info",
	Short: "Get system information",
	Run:   runSystemCmd,
}

var historyCmd = &cobra.Command{
	Use:   "history",
	Short: "Get image history",
	Run:   runSystemCmd,
}

func init() {
	rootCmd.AddCommand(systemCmd)
	systemCmd.AddCommand(infoCmd)
	systemCmd.AddCommand(historyCmd)
}

func runSystemCmd(cmd *cobra.Command, args []string) {
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

	msg := &ipc.Message{Action: "get_" + cmd.Name()}

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
