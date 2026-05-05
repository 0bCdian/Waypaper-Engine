package themes_test

import (
	"os"
	"path/filepath"
	"testing"

	"waypaper-engine/daemon/internal/themes"
)

func TestListThemes_ReadsCSSFilesFromDir(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "neon.css"), []byte(`/* test */
@plugin "daisyui/theme" { name: "neon"; }`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "ignored.txt"), []byte("nope"), 0o644); err != nil {
		t.Fatal(err)
	}

	got, err := themes.List(dir)
	if err != nil {
		t.Fatalf("List error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 theme, got %d", len(got))
	}
	if got[0].Name != "neon" {
		t.Errorf("expected name=neon, got %q", got[0].Name)
	}
	if got[0].Source != "user" {
		t.Errorf("expected source=user, got %q", got[0].Source)
	}
	if got[0].URL != "/api/themes/neon.css" {
		t.Errorf("expected url=/api/themes/neon.css, got %q", got[0].URL)
	}
}

func TestListThemes_ReturnsEmptyWhenDirMissing(t *testing.T) {
	got, err := themes.List(filepath.Join(t.TempDir(), "doesnotexist"))
	if err != nil {
		t.Fatalf("List error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty slice, got %v", got)
	}
}

func TestListThemes_SortsAlphabetically(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"zebra.css", "alpha.css", "mango.css"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("/* x */"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	got, err := themes.List(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 {
		t.Fatalf("expected 3, got %d", len(got))
	}
	if got[0].Name != "alpha" || got[1].Name != "mango" || got[2].Name != "zebra" {
		t.Errorf("unexpected order: %v", got)
	}
}

func TestOpen_RejectsPathTraversal(t *testing.T) {
	dir := t.TempDir()
	if _, err := themes.Open(dir, "../../etc/passwd"); err == nil {
		t.Errorf("expected error for ../../etc/passwd, got nil")
	}
	if _, err := themes.Open(dir, ""); err == nil {
		t.Errorf("expected error for empty name, got nil")
	}
	if _, err := themes.Open(dir, "with/slash"); err == nil {
		t.Errorf("expected error for slashed name, got nil")
	}
	if _, err := themes.Open(dir, "with\\backslash"); err == nil {
		t.Errorf("expected error for backslash name, got nil")
	}
}

func TestOpen_ReadsValidFile(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "x.css"), []byte("body{}"), 0o644); err != nil {
		t.Fatal(err)
	}
	f, err := themes.Open(dir, "x")
	if err != nil {
		t.Fatalf("Open error: %v", err)
	}
	defer f.Close()
}

func TestOpen_ReturnsNotFoundForMissing(t *testing.T) {
	dir := t.TempDir()
	_, err := themes.Open(dir, "ghost")
	if err == nil {
		t.Error("expected error for missing file")
	}
}
