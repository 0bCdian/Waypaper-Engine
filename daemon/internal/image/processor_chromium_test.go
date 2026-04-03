package image

import "testing"

func TestH264Baseline4KChromiumIssue(t *testing.T) {
	t.Parallel()
	if !h264Baseline4KChromiumIssue("h264", "Constrained Baseline", 3840, 2160) {
		t.Fatal("expected Constrained Baseline 4K to need proxy")
	}
	if h264Baseline4KChromiumIssue("h264", "Main", 3840, 2160) {
		t.Fatal("Main profile 4K should not use this heuristic (matches typical playable encodes)")
	}
	if h264Baseline4KChromiumIssue("h264", "Constrained Baseline", 1280, 720) {
		t.Fatal("720p baseline should not need proxy")
	}
}
