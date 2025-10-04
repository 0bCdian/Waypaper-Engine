package cli

import (
	"context"
	"fmt"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/ipc"
	"waypaper-engine/daemon-go/internal/models"

	"github.com/spf13/cobra"
)

var playlistCmd = &cobra.Command{
	Use:   "playlist",
	Short: "Manage playlists",
}

var startPlaylistCmd = &cobra.Command{
	Use:   "start [playlist_name] [monitor_name]",
	Short: "Start a playlist on a monitor",
	Args:  cobra.ExactArgs(2),
	Run:   runPlaylistCmd,
}

var stopPlaylistCmd = &cobra.Command{
	Use:   "stop [monitor_name]",
	Short: "Stop a playlist on a monitor",
	Args:  cobra.ExactArgs(1),
	Run:   runPlaylistCmd,
}

var pausePlaylistCmd = &cobra.Command{
	Use:   "pause [monitor_name]",
	Short: "Pause a playlist on a monitor",
	Args:  cobra.ExactArgs(1),
	Run:   runPlaylistCmd,
}

var resumePlaylistCmd = &cobra.Command{
	Use:   "resume [monitor_name]",
	Short: "Resume a playlist on a monitor",
	Args:  cobra.ExactArgs(1),
	Run:   runPlaylistCmd,
}

var nextImageCmd = &cobra.Command{
	Use:   "next [monitor_name]",
	Short: "Set the next image in the playlist",
	Args:  cobra.ExactArgs(1),
	Run:   runPlaylistCmd,
}

var prevImageCmd = &cobra.Command{
	Use:   "prev [monitor_name]",
	Short: "Set the previous image in the playlist",
	Args:  cobra.ExactArgs(1),
	Run:   runPlaylistCmd,
}

func init() {
	rootCmd.AddCommand(playlistCmd)
	playlistCmd.AddCommand(startPlaylistCmd)
	playlistCmd.AddCommand(stopPlaylistCmd)
	playlistCmd.AddCommand(pausePlaylistCmd)
	playlistCmd.AddCommand(resumePlaylistCmd)
	playlistCmd.AddCommand(nextImageCmd)
	playlistCmd.AddCommand(prevImageCmd)
}

func runPlaylistCmd(cmd *cobra.Command, args []string) {
	client, err := ipc.NewClient()
	if err != nil {
		fmt.Printf("Failed to connect to daemon: %v\n", err)
		return
	}
	defer client.Close()

	dbManager, err := db.NewDatabaseManager("waypaper.db", db.DefaultPoolConfig())
	if err != nil {
		fmt.Printf("Failed to connect to database: %v\n", err)
		return
	}
	defer dbManager.Close()

	msg, err := buildPlaylistMessage(cmd.Name(), args, db.NewDatabaseOperations(dbManager))
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

func buildPlaylistMessage(action string, args []string, dbOps *db.DatabaseOperations) (*ipc.Message, error) {
	msg := &ipc.Message{Action: action}

	switch action {
	case "start":
		playlist, err := dbOps.GetPlaylistByName(context.Background(), args[0])
		if err != nil {
			return nil, err
		}
		msg.PlaylistID = playlist.ID

		// For CLI, we'll use a simple monitor setup
		// In a real implementation, this would query the system for monitors
		msg.ActiveMonitor = &models.ActiveMonitor{
			Name: args[1],
			Monitors: []models.Monitor{{
				Name:   args[1],
				Width:  1920,
				Height: 1080,
			}},
		}

	case "stop", "pause", "resume", "next", "prev":
		msg.ActiveMonitor = &models.ActiveMonitor{Name: args[0]}
	default:
		return nil, fmt.Errorf("unknown playlist action: %s", action)
	}

	return msg, nil
}
