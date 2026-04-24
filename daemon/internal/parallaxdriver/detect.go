package parallaxdriver

import (
	"context"
	"os"
	"os/exec"
	"strings"
	"time"
)

// Kind identifies which compositor integration to run.
type Kind int

const (
	None Kind = iota
	Hyprland
	Sway
)

// DriverMode selects compositor parallax bridging (config: parallax_compositor_driver).
type DriverMode string

const (
	ModeOff      DriverMode = "off"
	ModeAuto     DriverMode = "auto"
	ModeHyprland DriverMode = "hyprland"
	ModeSway     DriverMode = "sway"
)

// ParseDriverMode normalizes user/config strings.
func ParseDriverMode(s string) DriverMode {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "", "auto":
		return ModeAuto
	case "off", "false", "no", "none":
		return ModeOff
	case "hyprland":
		return ModeHyprland
	case "sway":
		return ModeSway
	default:
		return ModeAuto
	}
}

// EffectiveKind resolves Mode + runtime environment.
func EffectiveKind(mode DriverMode) Kind {
	switch mode {
	case ModeOff:
		return None
	case ModeHyprland:
		if isHyprlandSession() {
			return Hyprland
		}
		return None
	case ModeSway:
		if isSwaySession() {
			return Sway
		}
		return None
	case ModeAuto:
		if isHyprlandSession() {
			return Hyprland
		}
		if isSwaySession() {
			return Sway
		}
		return None
	default:
		return None
	}
}

func isHyprlandSession() bool {
	if os.Getenv("HYPRLAND_INSTANCE_SIGNATURE") == "" {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := exec.CommandContext(ctx, hyprctlBinary(), "version").Run(); err != nil {
		return false
	}
	return true
}

func isSwaySession() bool {
	if os.Getenv("SWAYSOCK") != "" {
		return true
	}
	if os.Getenv("WAYLAND_DISPLAY") == "" {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return exec.CommandContext(ctx, "swaymsg", "-t", "get_version").Run() == nil
}
