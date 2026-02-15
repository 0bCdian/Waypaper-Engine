package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"waypaper-engine/daemon/internal/system"
)

// buildCLI creates the root command and subcommands.
func buildCLI() *cobra.Command {
	var configPath string
	var logLevel string

	rootCmd := &cobra.Command{
		Use:   "waypaper-daemon",
		Short: "Waypaper Engine daemon — manages wallpapers, playlists, and image processing",
		Long: `waypaper-daemon is the background service for Waypaper Engine.

It provides an HTTP API over a Unix domain socket for managing wallpapers,
playlists, images, monitors, and configuration.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return startDaemon(configPath, logLevel)
		},
	}

	rootCmd.PersistentFlags().StringVarP(&configPath, "config", "c", "", "config file path (default: $XDG_CONFIG_HOME/waypaper-engine/config.toml)")
	rootCmd.PersistentFlags().StringVarP(&logLevel, "log-level", "l", "", "override log level (debug, info, warn, error)")

	rootCmd.AddCommand(buildStartCmd(&configPath, &logLevel))
	rootCmd.AddCommand(buildStopCmd())
	rootCmd.AddCommand(buildStatusCmd())
	rootCmd.AddCommand(buildSetCmd())
	rootCmd.AddCommand(buildRandomCmd())
	rootCmd.AddCommand(buildVersionCmd())

	return rootCmd
}

func buildStartCmd(configPath *string, logLevel *string) *cobra.Command {
	return &cobra.Command{
		Use:   "start",
		Short: "Start the daemon (default action)",
		RunE: func(cmd *cobra.Command, args []string) error {
			return startDaemon(*configPath, *logLevel)
		},
	}
}

func buildStopCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "stop",
		Short: "Stop the running daemon",
		RunE: func(cmd *cobra.Command, args []string) error {
			resp, err := doRequest("POST", "/shutdown", nil)
			if err != nil {
				return fmt.Errorf("failed to stop daemon: %w", err)
			}
			defer resp.Body.Close()
			printJSON(resp.Body)
			return nil
		},
	}
}

func buildStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show daemon status and info",
		RunE: func(cmd *cobra.Command, args []string) error {
			resp, err := doRequest("GET", "/info", nil)
			if err != nil {
				return fmt.Errorf("daemon not reachable: %w", err)
			}
			defer resp.Body.Close()
			printJSON(resp.Body)
			return nil
		},
	}
}

func buildSetCmd() *cobra.Command {
	var monitorName string
	var mode string

	cmd := &cobra.Command{
		Use:   "set [image-id]",
		Short: "Set a wallpaper by image ID",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			body := map[string]any{
				"image_id": args[0],
				"monitor":  monitorName,
				"mode":     mode,
			}
			jsonBody, _ := json.Marshal(body)
			resp, err := doRequest("POST", "/wallpaper/set", strings.NewReader(string(jsonBody)))
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			printJSON(resp.Body)
			return nil
		},
	}

	cmd.Flags().StringVarP(&monitorName, "monitor", "m", "*", "target monitor name (* for all)")
	cmd.Flags().StringVar(&mode, "mode", "individual", "monitor mode (individual, clone, extend)")

	return cmd
}

func buildRandomCmd() *cobra.Command {
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
			jsonBody, _ := json.Marshal(body)
			resp, err := doRequest("POST", "/wallpaper/random", strings.NewReader(string(jsonBody)))
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			printJSON(resp.Body)
			return nil
		},
	}

	cmd.Flags().StringVarP(&monitorName, "monitor", "m", "*", "target monitor name (* for all)")
	cmd.Flags().StringVar(&mode, "mode", "individual", "monitor mode (individual, clone, extend)")

	return cmd
}

func buildVersionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print daemon version",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("waypaper-daemon %s\n", version)
		},
	}
}

// doRequest sends an HTTP request to the daemon's Unix socket.
func doRequest(method, path string, body io.Reader) (*http.Response, error) {
	socketPath := system.DefaultSocketPath()

	client := &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				return net.Dial("unix", socketPath)
			},
		},
	}

	url := "http://localhost" + path
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	return client.Do(req)
}

// printJSON reads a response body and pretty-prints it.
func printJSON(r io.Reader) {
	data, err := io.ReadAll(r)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error reading response:", err)
		return
	}

	var parsed any
	if json.Unmarshal(data, &parsed) == nil {
		pretty, _ := json.MarshalIndent(parsed, "", "  ")
		fmt.Println(string(pretty))
	} else {
		fmt.Println(string(data))
	}
}
