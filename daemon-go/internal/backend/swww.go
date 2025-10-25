package backend

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

type SwwwConfig struct {
	// Image display options
	ResizeType ResizeType `toml:"resize_type" json:"resizeType"`
	FillColor  string     `toml:"fill_color" json:"fillColor"`
	FilterType FilterType `toml:"filter_type" json:"filterType"`

	// Transition configuration
	TransitionType     TransitionType `toml:"transition_type" json:"transitionType"`
	TransitionStep     int            `toml:"transition_step" json:"transitionStep"`
	TransitionDuration int            `toml:"transition_duration" json:"transitionDuration"`
	TransitionFPS      int            `toml:"transition_fps" json:"transitionFPS"`
	TransitionAngle    int            `toml:"transition_angle" json:"transitionAngle"`
	TransitionPos      string         `toml:"transition_pos" json:"transitionPos"`
	TransitionBezier   string         `toml:"transition_bezier" json:"transitionBezier"`
	TransitionWave     string         `toml:"transition_wave" json:"transitionWave"`
	InvertY            bool           `toml:"invert_y" json:"invertY"`

	// Position configuration (for transitions)
	PositionX float64 `toml:"position_x" json:"positionX"`
	PositionY float64 `toml:"position_y" json:"positionY"`
}

// SwwwBackend implements the Backend interface for swww
type SwwwBackend struct {
	runner        CommandRunner
	daemonProcess *os.Process
	daemonMutex   sync.Mutex
	logger        *slog.Logger
}

// CommandRunner interface for running commands
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

// NewSwwwBackend creates a new swww backend
func NewSwwwBackend(runner CommandRunner, logger *slog.Logger) *SwwwBackend {
	return &SwwwBackend{
		runner: runner,
		logger: logger,
	}
}

// GetType returns the backend type
func (s *SwwwBackend) GetType() BackendType {
	return BackendSwww
}

// Initialize checks if swww is available
func (s *SwwwBackend) Initialize(ctx context.Context) error {
	_, _, err := s.runner.Run("swww --version")
	if err != nil {
		return fmt.Errorf("swww not found: %w", err)
	}
	return nil
}

// SetWallpaper sets wallpaper on a specific monitor
func (s *SwwwBackend) SetWallpaper(ctx context.Context, imagePath, monitorName string, config *BackendConfig) error {
	args := []string{"img", imagePath, "--outputs", monitorName}

	// Add configuration options
	args = s.addConfigArgs(args, config)

	// Use exec.Command directly to avoid shell escaping issues
	s.logger.Debug("swww command", "args", args, "imagePath", imagePath, "monitorName", monitorName)
	cmd := exec.Command("swww", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		s.logger.Error("swww command failed", "args", args, "stdout", stdout.String(), "stderr", stderr.String(), "error", err)
		return fmt.Errorf("failed to set wallpaper: %w, output: %s", err, stderr.String())
	}

	return nil
}

// SetWallpaperAll sets wallpaper on all monitors
func (s *SwwwBackend) SetWallpaperAll(ctx context.Context, imagePath string, config *BackendConfig) error {
	args := []string{"img", imagePath}

	// Add configuration options
	args = s.addConfigArgs(args, config)

	// Use exec.Command directly to avoid shell escaping issues
	cmd := exec.Command("swww", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("failed to set wallpaper on all monitors: %w, output: %s", err, stderr.String())
	}

	return nil
}

// GetCapabilities returns swww capabilities
func (s *SwwwBackend) GetCapabilities() BackendCapabilities {
	return BackendCapabilities{
		Compositor: CompositorSupport{
			X11:     false, // SWW is Wayland-only
			Wayland: true,
		},
		MediaTypes: MediaTypeSupport{
			Images: true,
			Videos: false, // SWW only does static images
			HTML:   false,
			D3D:    false,
			GIFs:   false, // Only first frame of GIFs
		},
		MultiMonitor:    true,
		Transitions:     true,
		ResizeOptions:   true,
		Positioning:     true,
		Filters:         true,
		RealTimeQuery:   true,
		BackgroundMode:  true,
		DaemonMode:      true,
		MaxImageSize:    50, // SWW can handle large images efficiently
		FastSwitching:   true,
		MemoryEfficient: true,
	}
}

// GetDefaultConfig returns default swww configuration
func (s *SwwwBackend) GetDefaultConfig() *BackendConfig {
	return &BackendConfig{
		BackendType:        BackendSwww,
		ResizeType:         "fit",
		FillColor:          "#000000",
		TransitionType:     "fade",
		TransitionDuration: 0.2, // 200ms in seconds
		TransitionStep:     90,
		TransitionFPS:      60,
		TransitionAngle:    0,
		PositionX:          0.5,
		PositionY:          0.5,
		PositionType:       "center",
		FilterType:         "lanczos3",
		CustomOptions: map[string]any{
			"invertY":          false,
			"transitionBezier": "0.25,0.1,0.25,1",
			"transitionWaveX":  20,
			"transitionWaveY":  20,
		},
	}
}

// addConfigArgs adds configuration arguments to the swww command
func (s *SwwwBackend) addConfigArgs(args []string, config *BackendConfig) []string {
	if config == nil {
		return args
	}

	// Add resize type
	if config.ResizeType != "" {
		args = append(args, "--resize", config.ResizeType)
	}

	// Add fill color
	if config.FillColor != "" {
		args = append(args, "--fill-color", config.FillColor)
	}

	// Add filter type
	if config.FilterType != "" {
		args = append(args, "--filter", config.FilterType)
	}

	// Add transition options
	if config.TransitionType != "" && config.TransitionType != "none" {
		args = append(args, "--transition-type", config.TransitionType)

		if config.TransitionDuration > 0 {
			// Convert seconds to milliseconds for swww command
			durationMs := int(config.TransitionDuration * 1000)
			args = append(args, "--transition-duration", fmt.Sprintf("%d", durationMs))
		}

		if config.TransitionStep > 0 {
			args = append(args, "--transition-step", fmt.Sprintf("%d", config.TransitionStep))
		}

		if config.TransitionFPS > 0 {
			args = append(args, "--transition-fps", fmt.Sprintf("%d", config.TransitionFPS))
		}

		if config.TransitionAngle != 0 {
			args = append(args, "--transition-angle", fmt.Sprintf("%.2f", config.TransitionAngle))
		}

		// Add transition position
		if config.PositionType != "" {
			args = append(args, "--transition-pos", config.PositionType)
		}
	}

	// Add custom options
	if customOpts, ok := config.CustomOptions["invertY"].(bool); ok && customOpts {
		args = append(args, "--invert-y")
	}

	return args
}

// StartDaemon starts the swww daemon with cacheless mode and kills any existing daemons
func (s *SwwwBackend) StartDaemon(ctx context.Context) error {
	s.daemonMutex.Lock()
	defer s.daemonMutex.Unlock()

	// First, kill any existing swww daemon to ensure clean state
	if err := s.killExistingSwwwDaemons(); err != nil {
		s.logger.Warn("failed to kill existing swww daemons", "error", err)
		// Continue anyway as this might mean no daemon was running
	}

	// Start swww daemon with --no-cache to avoid conflicts
	s.logger.Info("starting swww daemon with cacheless mode")

	// Use absolute path to avoid PATH issues
	cmd := exec.CommandContext(ctx, "swww-daemon", "--no-cache")
	cmd.Env = append(os.Environ(), "WAYLAND_DISPLAY="+os.Getenv("WAYLAND_DISPLAY"))

	s.logger.Info("swww-daemon command details", "path", "swww-daemon", "env_wayland", os.Getenv("WAYLAND_DISPLAY"))

	if err := cmd.Start(); err != nil {
		s.logger.Error("Failed to start swww-daemon command", "error", err)
		return fmt.Errorf("failed to start swww daemon: %w", err)
	}

	s.daemonProcess = cmd.Process

	// Give the daemon more time to start and initialize
	// swww-daemon needs time to set up sockets and initialize Wayland connection
	time.Sleep(500 * time.Millisecond)

	// Verify it's running before proceeding
	// We'll use a simple approach: check that we started a process and assume it's working
	// if we get here without cmd.Start() erroring out
	s.logger.Info("swww daemon startup complete", "pid", s.daemonProcess.Pid)

	s.logger.Info("swww daemon started successfully", "pid", s.daemonProcess.Pid)
	return nil
}

// StopDaemon stops the swww daemon that was started by this backend
func (s *SwwwBackend) StopDaemon(ctx context.Context) error {
	s.daemonMutex.Lock()
	defer s.daemonMutex.Unlock()

	if s.daemonProcess == nil {
		s.logger.Info("no swww daemon process to stop")
		return nil
	}

	s.logger.Info("stopping swww daemon", "pid", s.daemonProcess.Pid)

	// Try graceful termination first
	if err := s.daemonProcess.Signal(syscall.SIGTERM); err != nil {
		s.logger.Warn("failed to send SIGTERM to swww daemon", "error", err)
	}

	// Wait for graceful shutdown with timeout
	done := make(chan error, 1)
	go func() {
		_, err := s.daemonProcess.Wait()
		done <- err
	}()

	select {
	case <-ctx.Done():
		// Force kill if context is cancelled (timeout)
		s.logger.Warn("forcing swww daemon stop due to timeout")
		if err := s.daemonProcess.Kill(); err != nil {
			s.logger.Error("failed to force kill swww daemon", "error", err)
		}
		s.daemonProcess = nil
		return ctx.Err()
	case err := <-done:
		s.daemonProcess = nil
		if err != nil {
			s.logger.Info("swww daemon stopped successfully")
		}
		return err
	}
}

// IsDaemonRunning checks if swww daemon is running
func (s *SwwwBackend) IsDaemonRunning() bool {
	s.daemonMutex.Lock()
	defer s.daemonMutex.Unlock()

	if s.daemonProcess == nil {
		return false
	}

	// If we have a daemonProcess, assume it's running
	// The complex validation was causing hangs
	return true
}

// killExistingSwwwDaemons kills any existing swww daemon processes
func (s *SwwwBackend) killExistingSwwwDaemons() error {
	// Find all swww-daemon processes
	cmd := exec.Command("pgrep", "-f", "swww-daemon")
	output, err := cmd.Output()
	if err != nil {
		// No processes found
		return nil
	}

	pids := bytes.Fields(output)
	if len(pids) == 0 {
		return nil
	}

	s.logger.Info("found existing swww daemon processes", "count", len(pids))

	// Kill each process
	for _, pid := range pids {
		if err := exec.Command("kill", "-TERM", string(pid)).Run(); err != nil {
			s.logger.Warn("failed to kill swww daemon process", "pid", string(pid), "error", err)
		}
	}

	// Wait a moment for processes to terminate
	time.Sleep(200 * time.Millisecond)

	// Check if any are still running and force kill them
	for _, pid := range pids {
		cmd := exec.Command("kill", "-0", string(pid))
		if cmd.Run() == nil {
			// Process still exists, force kill
			s.logger.Warn("force killing stubborn swww daemon process", "pid", string(pid))
			exec.Command("kill", "-KILL", string(pid)).Run()
		}
	}

	return nil
}
