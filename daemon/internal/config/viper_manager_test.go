package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func fakeBackendDefaults(v *viper.Viper) {
	v.SetDefault("backend.wal-qt.socket_path", "/run/wal-qt.sock")
	v.SetDefault("backend.wal-qt.parallax_enabled", false)
	v.SetDefault("backend.wal-qt.parallax_zoom", 120)
	v.SetDefault("backend.wal-qt.parallax_step_percent", 5)
}

func decodeBackendConfig(t *testing.T, raw json.RawMessage) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.Unmarshal(raw, &m))
	return m
}

func TestBackendConfig_PartialTableDropsDefaults_WhenRegistrarMissing(t *testing.T) {
	cfgPath := filepath.Join(t.TempDir(), "config.toml")
	m, err := NewViperManager(cfgPath)
	require.NoError(t, err)

	fakeBackendDefaults(m.Viper())

	require.NoError(t, m.SetBackendConfig("wal-qt", json.RawMessage(`{"parallax_zoom":175}`)))

	got := decodeBackendConfig(t, mustGetBackendConfig(t, m, "wal-qt"))
	assert.EqualValues(t, 175, got["parallax_zoom"], "the explicitly-set key survives")
	assert.NotContains(t, got, "parallax_step_percent",
		"bug: the other defaults are dropped from the UI-visible config")
}

func TestEnsureDefaultsPersisted_KeepsBackendTableComplete(t *testing.T) {
	cfgPath := filepath.Join(t.TempDir(), "config.toml")
	m, err := NewViperManager(cfgPath)
	require.NoError(t, err)
	fakeBackendDefaults(m.Viper())

	require.NoError(t, m.EnsureDefaultsPersisted(fakeBackendDefaults))

	t.Run("defaults are written to the file on disk", func(t *testing.T) {
		data, readErr := os.ReadFile(cfgPath)
		require.NoError(t, readErr)
		text := string(data)
		assert.True(t, strings.Contains(text, "parallax_zoom"),
			"config.toml should physically contain backend defaults:\n%s", text)
		assert.True(t, strings.Contains(text, "parallax_step_percent"), text)
	})

	t.Run("GetBackendConfig returns the full default set", func(t *testing.T) {
		got := decodeBackendConfig(t, mustGetBackendConfig(t, m, "wal-qt"))
		assert.EqualValues(t, 120, got["parallax_zoom"])
		assert.EqualValues(t, 5, got["parallax_step_percent"])
		assert.Equal(t, false, got["parallax_enabled"])
		assert.Equal(t, "/run/wal-qt.sock", got["socket_path"])
	})

	t.Run("changing one key does not collapse the rest", func(t *testing.T) {
		require.NoError(t, m.SetBackendConfig("wal-qt", json.RawMessage(`{"parallax_zoom":175}`)))
		got := decodeBackendConfig(t, mustGetBackendConfig(t, m, "wal-qt"))
		assert.EqualValues(t, 175, got["parallax_zoom"], "the changed key is persisted")
		assert.EqualValues(t, 5, got["parallax_step_percent"], "untouched defaults survive")
		assert.Equal(t, "/run/wal-qt.sock", got["socket_path"])
	})
}

func TestEnsureDefaultsPersisted_SkipsRewriteWhenComplete(t *testing.T) {
	cfgPath := filepath.Join(t.TempDir(), "config.toml")
	m, err := NewViperManager(cfgPath)
	require.NoError(t, err)
	fakeBackendDefaults(m.Viper())

	require.NoError(t, m.EnsureDefaultsPersisted(fakeBackendDefaults))
	first, err := os.ReadFile(cfgPath)
	require.NoError(t, err)

	require.NoError(t, m.EnsureDefaultsPersisted(fakeBackendDefaults))
	second, err := os.ReadFile(cfgPath)
	require.NoError(t, err)

	assert.Equal(t, string(first), string(second),
		"a complete file must not be rewritten")
}

func mustGetBackendConfig(t *testing.T, m *ViperManager, name string) json.RawMessage {
	t.Helper()
	raw, err := m.GetBackendConfig(name)
	require.NoError(t, err)
	return raw
}

func TestConcurrentReadsAndWrites_NoDataRace(t *testing.T) {
	cfgPath := filepath.Join(t.TempDir(), "config.toml")
	m, err := NewViperManager(cfgPath)
	require.NoError(t, err)

	m.OnConfigChange(func(_ string) {})

	const iterations = 50
	var wg sync.WaitGroup

	wg.Add(4)
	go func() {
		defer wg.Done()
		for i := 0; i < iterations; i++ {
			_ = m.SetBackendConfig("wal-qt", json.RawMessage(`{"parallax_zoom":100}`))
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < iterations; i++ {
			_ = m.UpdateConfig("app", map[string]any{"theme": "dark"})
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < iterations; i++ {
			_, _ = m.GetConfig()
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < iterations; i++ {
			_, _ = m.GetSection("app")
			_, _ = m.GetBackendConfig("wal-qt")
		}
	}()

	wg.Wait()
}

func TestClose_StopsWatcherGoroutine(t *testing.T) {
	cfgPath := filepath.Join(t.TempDir(), "config.toml")

	runtime.GC()
	time.Sleep(50 * time.Millisecond)
	before := runtime.NumGoroutine()

	m, err := NewViperManager(cfgPath)
	require.NoError(t, err)

	deadline := time.Now().Add(2 * time.Second)
	for runtime.NumGoroutine() <= before && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	during := runtime.NumGoroutine()
	assert.Greater(t, during, before, "expected NewViperManager to start a watcher goroutine")

	require.NoError(t, m.Close())

	deadline = time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if runtime.NumGoroutine() <= before {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	assert.LessOrEqual(t, runtime.NumGoroutine(), before,
		"watcher goroutine leaked after Close")

	require.NoError(t, m.Close())
}
