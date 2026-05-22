package walqt

import (
	"slices"
	"testing"
)

func TestValidateEnvEntries(t *testing.T) {
	cases := []struct {
		name    string
		entries []string
		wantErr bool
	}{
		{"nil", nil, false},
		{"valid chromium flags", []string{"QTWEBENGINE_CHROMIUM_FLAGS=--disable-gpu --ignore-gpu-blocklist"}, false},
		{"valid multiple", []string{"QSG_RHI_BACKEND=software", "LIBGL_ALWAYS_SOFTWARE=1"}, false},
		{"empty value allowed", []string{"FOO="}, false},
		{"missing equals", []string{"NOEQUALS"}, true},
		{"empty key", []string{"=value"}, true},
		{"whitespace in key", []string{"BAD KEY=v"}, true},
		{"protected WAYLAND_DISPLAY", []string{"WAYLAND_DISPLAY=wayland-9"}, true},
		{"protected key case-insensitive", []string{"path=/evil"}, true},
		{"protected LD_PRELOAD", []string{"LD_PRELOAD=/tmp/x.so"}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateEnvEntries(tc.entries)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validateEnvEntries(%v) err = %v, wantErr %v", tc.entries, err, tc.wantErr)
			}
		})
	}
}

func TestMergeProcessEnv(t *testing.T) {
	base := []string{"PATH=/usr/bin", "HOME=/home/u"}

	if got := mergeProcessEnv(base, nil); !slices.Equal(got, base) {
		t.Fatalf("empty extra: got %v, want %v", got, base)
	}

	got := mergeProcessEnv(base, []string{"FOO=bar", "   ", "BAZ=qux"})
	want := []string{"PATH=/usr/bin", "HOME=/home/u", "FOO=bar", "BAZ=qux"}
	if !slices.Equal(got, want) {
		t.Fatalf("merge: got %v, want %v", got, want)
	}
}

func TestValidateConfigRejectsProtectedEnv(t *testing.T) {
	b := New()
	if err := b.ValidateConfig([]byte(`{"env":["QT_SCALE_FACTOR=2"]}`)); err != nil {
		t.Fatalf("valid env rejected: %v", err)
	}
	if err := b.ValidateConfig([]byte(`{"env":["PATH=/evil"]}`)); err == nil {
		t.Fatal("protected env key accepted, want rejection")
	}
}
