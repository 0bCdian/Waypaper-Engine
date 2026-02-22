package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"waypaper-engine/daemon/internal/system"
)

var jsonOutput bool

// buildCLI creates the root command and subcommands.
func buildCLI() *cobra.Command {
	var configPath string
	var logLevel string

	rootCmd := &cobra.Command{
		Use:   "waypaper-daemon",
		Short: "Waypaper Engine daemon — manages wallpapers, playlists, and image processing",
		Long: `waypaper-daemon is the background service for Waypaper Engine.

It provides an HTTP API over a Unix domain socket for managing wallpapers,
playlists, images, monitors, and configuration.

Run without a subcommand to start the daemon. Use subcommands to interact
with a running daemon instance.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return startDaemon(configPath, logLevel)
		},
	}

	rootCmd.PersistentFlags().StringVarP(&configPath, "config", "c", "", "config file path (default: $XDG_CONFIG_HOME/waypaper-engine/config.toml)")
	rootCmd.PersistentFlags().StringVarP(&logLevel, "log-level", "l", "", "override log level (debug, info, warn, error)")
	rootCmd.PersistentFlags().BoolVar(&jsonOutput, "json", false, "output raw compact JSON (for scripting)")

	// Daemon lifecycle commands.
	rootCmd.AddCommand(buildStartCmd(&configPath, &logLevel))
	rootCmd.AddCommand(buildStopCmd())
	rootCmd.AddCommand(buildStatusCmd())
	rootCmd.AddCommand(buildVersionCmd())

	// Wallpaper commands (top-level shortcuts).
	rootCmd.AddCommand(buildSetCmd())
	rootCmd.AddCommand(buildRandomCmd())
	rootCmd.AddCommand(buildNextCmd())
	rootCmd.AddCommand(buildPreviousCmd())

	// Domain subcommand groups.
	rootCmd.AddCommand(buildImagesCmd())
	rootCmd.AddCommand(buildPlaylistCmd())
	rootCmd.AddCommand(buildMonitorsCmd())
	rootCmd.AddCommand(buildBackendsCmd())
	rootCmd.AddCommand(buildConfigCmd())
	rootCmd.AddCommand(buildWallpaperCmd())
	rootCmd.AddCommand(buildFoldersCmd())
	rootCmd.AddCommand(buildEventsCmd())

	return rootCmd
}

// --- Daemon lifecycle commands ---

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
			if err := checkResponse(resp); err != nil {
				return err
			}
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
			if err := checkResponse(resp); err != nil {
				return err
			}
			printJSON(resp.Body)
			return nil
		},
	}
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

// --- Top-level wallpaper shortcuts ---

func buildSetCmd() *cobra.Command {
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
			return doJSONRequest("POST", "/wallpaper/random", body)
		},
	}

	cmd.Flags().StringVarP(&monitorName, "monitor", "m", "*", "target monitor name (* for all)")
	cmd.Flags().StringVar(&mode, "mode", "individual", "monitor mode (individual, clone, extend)")

	return cmd
}

func buildNextCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "next",
		Short: "Go to next wallpaper in history",
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/wallpaper/history/next")
		},
	}
}

func buildPreviousCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "previous",
		Short:   "Go to previous wallpaper in history",
		Aliases: []string{"prev"},
		RunE: func(cmd *cobra.Command, args []string) error {
			return doSimpleRequest("POST", "/wallpaper/history/previous")
		},
	}
}

// --- Shared HTTP helpers ---

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

// checkResponse returns an error if the HTTP status code is not 2xx.
func checkResponse(resp *http.Response) error {
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	body, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("daemon returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
}

// doSimpleRequest performs a request with no body and prints the JSON response.
func doSimpleRequest(method, path string) error {
	resp, err := doRequest(method, path, nil)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	if err := checkResponse(resp); err != nil {
		return err
	}
	printJSON(resp.Body)
	return nil
}

// doJSONRequest marshals body as JSON, sends the request, and prints the response.
func doJSONRequest(method, path string, body any) error {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	resp, err := doRequest(method, path, strings.NewReader(string(jsonBody)))
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	if err := checkResponse(resp); err != nil {
		return err
	}
	printJSON(resp.Body)
	return nil
}

// printJSON reads a response body and prints it. When --json is set,
// output is compact JSON; otherwise it is pretty-printed.
func printJSON(r io.Reader) {
	data, err := io.ReadAll(r)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error reading response:", err)
		return
	}

	if jsonOutput {
		var parsed any
		if json.Unmarshal(data, &parsed) == nil {
			compact, _ := json.Marshal(parsed)
			fmt.Println(string(compact))
		} else {
			fmt.Print(string(data))
		}
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
