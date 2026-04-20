package image

import (
	"strings"
	"testing"
)

func TestBuildVideoLoopFFmpegArgs_webm(t *testing.T) {
	args, err := BuildVideoLoopFFmpegArgs("/in/video.mp4", "/tmp/out.webm", 1.5, 10.25, VideoLoopPresetWebMVP9)
	if err != nil {
		t.Fatal(err)
	}
	s := strings.Join(args, " ")
	if !strings.Contains(s, "-i /in/video.mp4") {
		t.Fatalf("missing input: %s", s)
	}
	if !strings.Contains(s, "-ss 1.500000") || !strings.Contains(s, "-to 10.250000") {
		t.Fatalf("trim flags: %s", s)
	}
	if !strings.Contains(s, "libvpx-vp9") || !strings.Contains(s, "/tmp/out.webm") {
		t.Fatalf("encoder or output: %s", s)
	}
}

func TestBuildVideoLoopFFmpegArgs_mp4(t *testing.T) {
	args, err := BuildVideoLoopFFmpegArgs("/a/b.webm", "/out/x.mp4", 0, 2, VideoLoopPresetMP4H264)
	if err != nil {
		t.Fatal(err)
	}
	s := strings.Join(args, " ")
	if !strings.Contains(s, "libx264") || !strings.Contains(s, "/out/x.mp4") {
		t.Fatalf("h264 output: %s", s)
	}
}

func TestBuildVideoLoopFFmpegArgs_invalidRange(t *testing.T) {
	_, err := BuildVideoLoopFFmpegArgs("/in", "/out.webm", 5, 5, VideoLoopPresetWebMVP9)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestPresetOutputExt(t *testing.T) {
	ext, fmt, err := presetOutputExt("WEBM_VP9")
	if err != nil || ext != ".webm" || fmt != "webm" {
		t.Fatalf("got %q %q %v", ext, fmt, err)
	}
	_, _, err = presetOutputExt("unknown")
	if err == nil {
		t.Fatal("expected error")
	}
}
