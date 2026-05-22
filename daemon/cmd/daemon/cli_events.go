package main

import (
	"bufio"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/spf13/cobra"
)

func buildEventsCmd() *cobra.Command {
	var types string

	cmd := &cobra.Command{
		Use:   "events",
		Short: "Stream daemon events (SSE) as JSON lines",
		Long: `Connect to the daemon's SSE event stream and print each event as a
JSON line to stdout. Useful for scripting and piping.

Example:
  waypaper-daemon events --types wallpaper_changed,playlist_started`,
		RunE: func(cmd *cobra.Command, args []string) error {
			path := "/events"
			if types != "" {
				path += "?types=" + types
			}

			resp, err := doRequest("GET", path, nil)
			if err != nil {
				return fmt.Errorf("failed to connect to event stream: %w", err)
			}
			defer resp.Body.Close()

			if err := checkResponse(resp); err != nil {
				return err
			}

			sigCh := make(chan os.Signal, 1)
			signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

			scanner := bufio.NewScanner(resp.Body)
			doneCh := make(chan struct{})

			go func() {
				defer close(doneCh)
				var eventType string
				for scanner.Scan() {
					line := scanner.Text()

					if strings.HasPrefix(line, "event:") {
						eventType = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
						continue
					}

					if strings.HasPrefix(line, "data:") {
						data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
						if eventType != "" {
							fmt.Fprintf(os.Stdout, "{\"event\":%q,\"data\":%s}\n", eventType, data)
						} else {
							fmt.Fprintln(os.Stdout, data)
						}
						eventType = ""
						continue
					}
				}
			}()

			select {
			case <-sigCh:
				return nil
			case <-doneCh:
				if err := scanner.Err(); err != nil {
					return fmt.Errorf("event stream error: %w", err)
				}
				return nil
			}
		},
	}

	cmd.Flags().StringVar(&types, "types", "", "comma-separated event types to filter (e.g. wallpaper_changed,playlist_started)")

	return cmd
}
