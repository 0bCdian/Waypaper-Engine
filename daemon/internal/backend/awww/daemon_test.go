package awww

import (
	"slices"
	"testing"
)

func TestAwwwDaemonArgs(t *testing.T) {
	if got := awwwDaemonArgs(""); !slices.Equal(got, []string{"--no-cache"}) {
		t.Fatalf("awwwDaemonArgs(\"\") = %v, want [--no-cache]", got)
	}
	got := awwwDaemonArgs("rgb")
	want := []string{"--no-cache", "--format", "rgb"}
	if !slices.Equal(got, want) {
		t.Fatalf("awwwDaemonArgs(\"rgb\") = %v, want %v", got, want)
	}
}

func TestValidateConfigDaemonFormat(t *testing.T) {
	b := New()
	for _, f := range []string{"", "argb", "abgr", "rgb", "bgr"} {
		if err := b.ValidateConfig([]byte(`{"daemon_format":"` + f + `"}`)); err != nil {
			t.Fatalf("daemon_format %q rejected: %v", f, err)
		}
	}
	if err := b.ValidateConfig([]byte(`{"daemon_format":"xrgb"}`)); err == nil {
		t.Fatal("invalid daemon_format accepted, want rejection")
	}
}
