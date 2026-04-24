package parallaxdriver

import (
	"bufio"
	"context"
	"errors"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// hyprlandSocket2Path returns the Hyprland event socket, or empty if not available.
func hyprlandSocket2Path() string {
	sig := os.Getenv("HYPRLAND_INSTANCE_SIGNATURE")
	runtimeDir := os.Getenv("XDG_RUNTIME_DIR")
	if sig == "" || runtimeDir == "" {
		return ""
	}
	return filepath.Join(runtimeDir, "hypr", sig, ".socket2.sock")
}

func isHyprlandWorkspaceEvent(line string) bool {
	// See https://wiki.hyprland.org/IPC/ — include v2 events and monitor moves so we
	// re-query `hyprctl -j monitors` after mouse-driven workspace / focus changes.
	switch {
	case strings.HasPrefix(line, "workspace>>"),
		strings.HasPrefix(line, "workspacev2>>"),
		strings.HasPrefix(line, "focusedmon>>"),
		strings.HasPrefix(line, "focusedmonv2>>"),
		strings.HasPrefix(line, "moveworkspace>>"),
		strings.HasPrefix(line, "moveworkspacev2>>"),
		strings.HasPrefix(line, "createworkspace>>"),
		strings.HasPrefix(line, "createworkspacev2>>"),
		strings.HasPrefix(line, "destroyworkspace>>"),
		strings.HasPrefix(line, "destroyworkspacev2>>"),
		strings.HasPrefix(line, "configreloaded>>"):
		return true
	default:
		return false
	}
}

func doHyprlandTick(ctx context.Context, st *workspaceParallaxAbsoluteState, opts RunOpts, log *slog.Logger) {
	tickCtx, cancel := context.WithTimeout(ctx, 600*time.Millisecond)
	defer cancel()
	entries, ok := hyprlandAllMonitorWorkspaces(tickCtx, log)
	if !ok {
		return
	}
	vert := opts.Vertical != nil && opts.Vertical()
	st.tick(tickCtx, entries, opts.Move, opts.ResolveMonitor, vert, opts.ChunkSize, log)
}

// runHyprlandSocket2 reads Hyprland socket2 until ctx is cancelled.
// Reconnects if the compositor recreates the socket (reload, crash).
func runHyprlandSocket2(ctx context.Context, opts RunOpts, log *slog.Logger) error {
	sock := hyprlandSocket2Path()
	if sock == "" {
		return errors.New("hyprland socket2: missing env")
	}
	if log == nil {
		log = slog.Default()
	}

	st := &workspaceParallaxAbsoluteState{}
	const reconnectDelay = 120 * time.Millisecond

	for ctx.Err() == nil {
		var d net.Dialer
		conn, err := d.DialContext(ctx, "unix", sock)
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(reconnectDelay):
				continue
			}
		}

		go func(c net.Conn) {
			<-ctx.Done()
			_ = c.Close()
		}(conn)

		doHyprlandTick(ctx, st, opts, log)

		reader := bufio.NewReader(conn)
		var readErr error
		for readErr == nil && ctx.Err() == nil {
			line, rerr := reader.ReadString('\n')
			if rerr != nil {
				readErr = rerr
				break
			}
			line = strings.TrimSpace(line)
			if !isHyprlandWorkspaceEvent(line) {
				continue
			}
			doHyprlandTick(ctx, st, opts, log)
		}
		_ = conn.Close()
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if readErr != nil {
			log.Debug("parallaxdriver hyprland: socket2 read error, reconnecting", "error", readErr)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(reconnectDelay):
			}
		}
	}
	return ctx.Err()
}
