package control

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

func TestUpdateBackendConfigValidatesBeforePersisting(t *testing.T) {
	cfg := newFakeConfig("awww")
	reg := newFakeRegistry(newFakeBackend("awww", withValidateErr(errors.New("bad config"))))
	c := NewController(cfg, reg, newFakeBus(), &fakeRestorer{})

	err := c.UpdateBackendConfig(context.Background(), "awww", json.RawMessage(`{"x":true}`))

	if err == nil {
		t.Fatal("expected validation error, got nil")
	}
	if cfg.wasBackendConfigPersisted("awww") {
		t.Fatal("config for awww was persisted before validation succeeded")
	}
}

func TestUpdateBackendConfigDoesNotSyncInactiveBackend(t *testing.T) {
	cfg := newFakeConfig("awww")
	active := newFakeBackend("awww")
	inactive := newFakeBackend("wal-qt")
	reg := newFakeRegistry(active, inactive)
	c := NewController(cfg, reg, newFakeBus(), &fakeRestorer{})

	err := c.UpdateBackendConfig(context.Background(), "wal-qt", json.RawMessage(`{"x":true}`))

	if err != nil {
		t.Fatalf("UpdateBackendConfig returned error: %v", err)
	}
	if inactive.syncCount != 0 {
		t.Fatalf("inactive backend sync count = %d, want 0", inactive.syncCount)
	}
	if active.syncCount != 0 {
		t.Fatalf("active backend sync count = %d, want 0", active.syncCount)
	}
}

func TestUpdateBackendConfigSyncsActiveBackend(t *testing.T) {
	cfg := newFakeConfig("awww")
	active := newFakeBackend("awww")
	reg := newFakeRegistry(active)
	c := NewController(cfg, reg, newFakeBus(), &fakeRestorer{})

	err := c.UpdateBackendConfig(context.Background(), "awww", json.RawMessage(`{"x":true}`))

	if err != nil {
		t.Fatalf("UpdateBackendConfig returned error: %v", err)
	}
	if active.syncCount != 1 {
		t.Fatalf("active backend sync count = %d, want 1", active.syncCount)
	}
}

func TestActivateBackendSwitchesRestoresAndPublishes(t *testing.T) {
	cfg := newFakeConfig("awww")
	oldActive := newFakeBackend("awww")
	newActive := newFakeBackend("wal-qt")
	reg := newFakeRegistry(oldActive, newActive)
	bus := newFakeBus()
	restorer := &fakeRestorer{}
	c := NewController(cfg, reg, bus, restorer)

	result, err := c.ActivateBackend(context.Background(), "wal-qt")

	if err != nil {
		t.Fatalf("ActivateBackend returned error: %v", err)
	}
	if result.Backend != "wal-qt" {
		t.Fatalf("result backend = %q, want %q", result.Backend, "wal-qt")
	}
	if result.AlreadyActive {
		t.Fatal("AlreadyActive = true, want false")
	}
	if got := reg.Active().Name(); got != "wal-qt" {
		t.Fatalf("registry active backend = %q, want %q", got, "wal-qt")
	}
	if oldActive.shutdownCount != 1 {
		t.Fatalf("old active backend shutdown count = %d, want 1", oldActive.shutdownCount)
	}
	if newActive.initializeCount != 1 {
		t.Fatalf("new active backend initialize count = %d, want 1", newActive.initializeCount)
	}
	if cfg.activeBackend != "wal-qt" {
		t.Fatalf("active backend config = %q, want %q", cfg.activeBackend, "wal-qt")
	}
	if restorer.callCount != 1 {
		t.Fatalf("restore call count = %d, want 1", restorer.callCount)
	}
	if got := bus.count(events.ConfigChanged); got != 1 {
		t.Fatalf("ConfigChanged events = %d, want 1", got)
	}
}

func TestResetBackendConfigToDefaults_UnknownBackend(t *testing.T) {
	cfg := newFakeConfig("awww")
	reg := newFakeRegistry(newFakeBackend("awww"))
	c := NewController(cfg, reg, newFakeBus(), nil)

	err := c.ResetBackendConfigToDefaults(context.Background(), "nope")
	if !errors.Is(err, ErrUnknownBackend) {
		t.Fatalf("err = %v, want ErrUnknownBackend", err)
	}
}

func TestResetBackendConfigToDefaults_SyncsWhenActive(t *testing.T) {
	cfg := newFakeConfig("awww")
	active := newFakeBackend("awww")
	reg := newFakeRegistry(active)
	restorer := &fakeRestorer{}
	c := NewController(cfg, reg, newFakeBus(), restorer)

	if err := c.ResetBackendConfigToDefaults(context.Background(), "awww"); err != nil {
		t.Fatal(err)
	}
	if active.syncCount != 1 {
		t.Fatalf("active syncCount = %d, want 1", active.syncCount)
	}
	if restorer.callCount != 1 {
		t.Fatalf("restore callCount = %d, want 1", restorer.callCount)
	}
}

func TestResetBackendConfigToDefaults_SkipsSyncWhenInactive(t *testing.T) {
	cfg := newFakeConfig("awww")
	active := newFakeBackend("awww")
	inactive := newFakeBackend("feh")
	reg := newFakeRegistry(active, inactive)
	restorer := &fakeRestorer{}
	c := NewController(cfg, reg, newFakeBus(), restorer)

	if err := c.ResetBackendConfigToDefaults(context.Background(), "feh"); err != nil {
		t.Fatal(err)
	}
	if inactive.syncCount != 0 {
		t.Fatalf("inactive syncCount = %d, want 0", inactive.syncCount)
	}
	if restorer.callCount != 0 {
		t.Fatalf("restore callCount = %d, want 0", restorer.callCount)
	}
}

type fakeConfig struct {
	activeBackend string
	backendConfig map[string]json.RawMessage
}

var _ config.ConfigManager = (*fakeConfig)(nil)

func newFakeConfig(activeBackend string) *fakeConfig {
	return &fakeConfig{
		activeBackend: activeBackend,
		backendConfig: make(map[string]json.RawMessage),
	}
}

func (f *fakeConfig) GetConfig() (*config.Config, error) {
	return &config.Config{Backend: config.BackendSection{Type: f.activeBackend}}, nil
}

func (f *fakeConfig) UpdateConfig(section string, values map[string]any) error {
	return nil
}

func (f *fakeConfig) GetSection(section string) (map[string]any, error) {
	return nil, nil
}

func (f *fakeConfig) GetBackendConfig(backendName string) (json.RawMessage, error) {
	return f.backendConfig[backendName], nil
}

func (f *fakeConfig) SetBackendConfig(backendName string, raw json.RawMessage) error {
	f.backendConfig[backendName] = append(json.RawMessage(nil), raw...)
	return nil
}

func (f *fakeConfig) GetActiveBackendType() string {
	return f.activeBackend
}

func (f *fakeConfig) SetActiveBackendType(name string) error {
	f.activeBackend = name
	return nil
}

func (f *fakeConfig) GetSelectionMode() string {
	return "fixed"
}

func (f *fakeConfig) GetAutoPriorities() config.AutoPriorities {
	return config.AutoPriorities{}
}

func (f *fakeConfig) OnConfigChange(callback func(section string)) {}

func (f *fakeConfig) GetSocketPath() string {
	return ""
}

func (f *fakeConfig) GetImagesDir() string {
	return ""
}

func (f *fakeConfig) GetThumbnailsDir() string {
	return ""
}

func (f *fakeConfig) GetDatabaseDir() string {
	return ""
}

func (f *fakeConfig) GetLogFile() string {
	return ""
}

func (f *fakeConfig) ResetToFactoryDefaults(func(*viper.Viper)) error {
	return nil
}

func (f *fakeConfig) ReplaceBackendNamedConfig(name string, values map[string]any) error {
	raw, err := json.Marshal(values)
	if err != nil {
		return err
	}
	f.backendConfig[name] = append(json.RawMessage(nil), raw...)
	return nil
}

func (f *fakeConfig) wasBackendConfigPersisted(backendName string) bool {
	_, ok := f.backendConfig[backendName]
	return ok
}

type fakeBackend struct {
	name            string
	validateErr     error
	syncCount       int
	initializeCount int
	shutdownCount   int
}

var _ backend.Backend = (*fakeBackend)(nil)

type fakeBackendOption func(*fakeBackend)

func newFakeBackend(name string, opts ...fakeBackendOption) *fakeBackend {
	b := &fakeBackend{name: name}
	for _, opt := range opts {
		opt(b)
	}
	return b
}

func withValidateErr(err error) fakeBackendOption {
	return func(b *fakeBackend) {
		b.validateErr = err
	}
}

func (f *fakeBackend) Name() string {
	return f.name
}

func (f *fakeBackend) IsAvailable() bool {
	return true
}

func (f *fakeBackend) Capabilities() backend.Capabilities {
	return backend.Capabilities{}
}

func (f *fakeBackend) Initialize(ctx context.Context) error {
	f.initializeCount++
	return nil
}

func (f *fakeBackend) Shutdown(ctx context.Context) error {
	f.shutdownCount++
	return nil
}

func (f *fakeBackend) Apply(_ context.Context, _ backend.Snapshot) error { return nil }

func (f *fakeBackend) SetWallpaper(ctx context.Context, req backend.WallpaperRequest) error {
	return nil
}

func (f *fakeBackend) RegisterDefaults(v *viper.Viper) {}

func (f *fakeBackend) ValidateConfig(raw json.RawMessage) error {
	return f.validateErr
}

func (f *fakeBackend) ParseConfig(raw json.RawMessage) (any, error) {
	return nil, nil
}

func (f *fakeBackend) OnConfigChanged(_ context.Context, _ json.RawMessage) error {
	f.syncCount++
	return nil
}

type fakeRegistry struct {
	backends map[string]backend.Backend
	active   string
}

var _ backend.Registry = (*fakeRegistry)(nil)

func newFakeRegistry(backends ...backend.Backend) *fakeRegistry {
	reg := &fakeRegistry{backends: make(map[string]backend.Backend)}
	for _, b := range backends {
		reg.backends[b.Name()] = b
		if reg.active == "" {
			reg.active = b.Name()
		}
	}
	return reg
}

func (f *fakeRegistry) Register(b backend.Backend) error {
	f.backends[b.Name()] = b
	return nil
}

func (f *fakeRegistry) Get(name string) (backend.Backend, bool) {
	b, ok := f.backends[name]
	return b, ok
}

func (f *fakeRegistry) HasActive() bool { return f.active != "" }
func (f *fakeRegistry) Active() backend.Backend {
	return f.backends[f.active]
}

func (f *fakeRegistry) SetActive(name string) error {
	if _, ok := f.backends[name]; !ok {
		return errors.New("unknown backend")
	}
	f.active = name
	return nil
}

func (f *fakeRegistry) Available() []backend.BackendInfo {
	return nil
}

func (f *fakeRegistry) Compatible(compositor monitor.CompositorType) []backend.BackendInfo {
	return nil
}

type fakeBus struct {
	published []events.Event
}

var _ events.Bus = (*fakeBus)(nil)

func newFakeBus() *fakeBus {
	return &fakeBus{}
}

func (f *fakeBus) Publish(event events.Event) {
	f.published = append(f.published, event)
}

func (f *fakeBus) Subscribe(types ...events.EventType) <-chan events.Event {
	return make(chan events.Event)
}

func (f *fakeBus) Unsubscribe(ch <-chan events.Event) {}

func (f *fakeBus) Close() {}

func (f *fakeBus) count(eventType events.EventType) int {
	count := 0
	for _, event := range f.published {
		if event.Type == eventType {
			count++
		}
	}
	return count
}

type fakeRestorer struct {
	callCount int
}

func (f *fakeRestorer) Restore(ctx context.Context) {
	f.callCount++
}
