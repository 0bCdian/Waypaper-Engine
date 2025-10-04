package monitor

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

// SwwwManager manages interactions with the swww daemon.
type SwwwManager struct {
	runner CommandRunner
}

// NewSwwwManager creates a new SwwwManager.
func NewSwwwManager(runner CommandRunner) *SwwwManager {
	return &SwwwManager{runner: runner}
}

// SwwwInit checks if the swww daemon is available.
func (m *SwwwManager) SwwwInit() error {
	_, _, err := m.runner.Run("swww --version")
	if err != nil {
		return fmt.Errorf("swww not found: %w", err)
	}
	return nil
}

// GetMonitors queries the swww daemon for monitor information.
func (m *SwwwManager) GetMonitors() ([]Monitor, error) {
	out, _, err := m.runner.Run("swww query")
	if err != nil {
		return nil, fmt.Errorf("failed to query swww: %w", err)
	}

	var wlrOutput []wlr_randr_monitor
	if err := json.Unmarshal([]byte(out), &wlrOutput); err != nil {
		return nil, fmt.Errorf("failed to unmarshal swww output: %w", err)
	}

	var monitors []Monitor
	for _, mon := range wlrOutput {
		monitors = append(monitors, Monitor{
			Name:   mon.Name,
			Width:  mon.Modes[0].Width,
			Height: mon.Modes[0].Height,
			Position: Position{
				X: mon.Position.X,
				Y: mon.Position.Y,
			},
		})
	}

	return monitors, nil
}

// SetWallpaper sets the wallpaper for a given monitor using the swww daemon.
func (m *SwwwManager) SetWallpaper(imagePath string, monitorName string) (string, error) {
	args := []string{"img", imagePath, "--outputs", monitorName}
	command := "swww " + strings.Join(args, " ")
	stdout, stderr, err := m.runner.Run(command)
	if err != nil {
		return "", fmt.Errorf("failed to set wallpaper: %w, output: %s", err, stderr)
	}

	return stdout, nil
}

// wlr_randr_monitor is the structure of the output from `swww query`.

type wlr_randr_monitor struct {
	Name     string   `json:"name"`
	Position Position `json:"position"`
	Modes    []struct {
		Width  int `json:"width"`
		Height int `json:"height"`
	} `json:"modes"`
}

// CommandRunner is an interface for running commands.
type CommandRunner interface {
	Run(command string) (string, string, error)
}

// SwwwCommandRunner is a real implementation of the CommandRunner.
type SwwwCommandRunner struct{}

// Run runs a command.
func (r *SwwwCommandRunner) Run(command string) (string, string, error) {
	cmd := exec.Command("bash", "-c", command)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	return stdout.String(), stderr.String(), err
}
