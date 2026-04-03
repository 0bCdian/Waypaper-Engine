package image

import (
	"os"
	"os/exec"
	"runtime"
)

// resolveFFmpeg returns ffmpeg: PATH first, then common install locations (daemon often has a minimal PATH).
func resolveFFmpeg() string {
	if p, err := exec.LookPath("ffmpeg"); err == nil && p != "" {
		return p
	}
	if runtime.GOOS == "windows" {
		return ""
	}
	for _, c := range []string{
		"/usr/bin/ffmpeg",
		"/usr/local/bin/ffmpeg",
		"/opt/homebrew/bin/ffmpeg",
	} {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c
		}
	}
	return ""
}

// resolveFFprobe returns ffprobe: PATH first, then common install locations.
func resolveFFprobe() string {
	if p, err := exec.LookPath("ffprobe"); err == nil && p != "" {
		return p
	}
	if runtime.GOOS == "windows" {
		return ""
	}
	for _, c := range []string{
		"/usr/bin/ffprobe",
		"/usr/local/bin/ffprobe",
		"/opt/homebrew/bin/ffprobe",
	} {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c
		}
	}
	return ""
}
