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

// countCallbacks registers a change callback and returns a func reporting how many times it fired.
func countCallbacks(m *ViperManager) func() int {
	var mu sync.Mutex
	n := 0
	m.OnConfigChange(func(string) {
		mu.Lock()
		n++
		mu.Unlock()
	})
	return func() int {
		mu.Lock()
		defer mu.Unlock()
		return n
	}
}

// settle waits long enough for fsnotify to deliver any pending events.
func settle() { time.Sleep(300 * time.Millisecond) }

func newWatchedManager(t *testing.T) (*ViperManager, string) {
	t.Helper()
	cfgPath := filepath.Join(t.TempDir(), "config.toml")
	m, err := NewViperManager(cfgPath)
	require.NoError(t, err)
	t.Cleanup(func() { _ = m.Close() })
	settle()
	return m, cfgPath
}

func TestWatcher_OwnWriteDoesNotNotify(t *testing.T) {
	m, _ := newWatchedManager(t)
	fired := countCallbacks(m)

	require.NoError(t, m.UpdateConfig("app", map[string]any{"theme": "nord"}))
	settle()

	assert.Equal(t, 0, fired())
}

func TestWatcher_ExternalEditNotifiesOnce(t *testing.T) {
	m, cfgPath := newWatchedManager(t)
	fired := countCallbacks(m)

	raw, err := os.ReadFile(cfgPath)
	require.NoError(t, err)
	edited := strings.Replace(string(raw), "kolision-raw", "nord", 1)
	require.NotEqual(t, string(raw), edited)
	require.NoError(t, os.WriteFile(cfgPath, []byte(edited), 0o644))
	settle()

	assert.Equal(t, 1, fired())
	assert.Equal(t, "nord", m.GetString("app.theme"))
}

func TestWatcher_IdenticalRewriteDoesNotNotify(t *testing.T) {
	m, cfgPath := newWatchedManager(t)
	fired := countCallbacks(m)

	raw, err := os.ReadFile(cfgPath)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(cfgPath, raw, 0o644))
	settle()

	assert.Equal(t, 0, fired())
}

func TestWatcher_RepeatedWritesOfSameContentNotifyOnce(t *testing.T) {
	m, cfgPath := newWatchedManager(t)
	fired := countCallbacks(m)

	raw, err := os.ReadFile(cfgPath)
	require.NoError(t, err)
	edited := []byte(strings.Replace(string(raw), "kolision-raw", "nord", 1))
	require.NoError(t, os.WriteFile(cfgPath, edited, 0o644))
	require.NoError(t, os.WriteFile(cfgPath, edited, 0o644))
	settle()

	assert.Equal(t, 1, fired())
}

func TestSaves_ReaderNeverSeesPartialFile(t *testing.T) {
	m, cfgPath := newWatchedManager(t)

	stop := make(chan struct{})
	bad := make(chan string, 1)
	go func() {
		for {
			select {
			case <-stop:
				return
			default:
			}
			raw, err := os.ReadFile(cfgPath)
			if err != nil || len(raw) == 0 || !strings.Contains(string(raw), "[app]") {
				select {
				case bad <- "empty, missing or partial config read":
				default:
				}
				return
			}
		}
	}()

	for i := range 100 {
		require.NoError(t, m.UpdateConfig("app", map[string]any{"images_per_page": 10 + i}))
	}
	close(stop)

	select {
	case msg := <-bad:
		t.Fatal(msg)
	default:
	}
}

func TestResetToFactoryDefaults_KeepsWatcherAlive(t *testing.T) {
	m, cfgPath := newWatchedManager(t)
	fired := countCallbacks(m)

	require.NoError(t, m.ResetToFactoryDefaults(fakeBackendDefaults))
	settle()
	require.Equal(t, 0, fired(), "reset is an API change; the controller publishes its event")

	raw, err := os.ReadFile(cfgPath)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(cfgPath, []byte(strings.Replace(string(raw), "kolision-raw", "nord", 1)), 0o644))
	settle()

	assert.Equal(t, 1, fired(), "external edits must still be seen after a reset")
}
