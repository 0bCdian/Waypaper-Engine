// Package apispec_test guards daemon/docs/openapi.yaml against drifting away
// from the Go structs that actually produce the JSON it documents.
//
// This generalises the earlier walqt-only check (which compared
// backend.Capabilities against the BackendCapabilities schema in one
// direction only) to every schema in openapi.yaml that corresponds to a
// concrete Go type, in both directions:
//
//   - Go -> spec: every json tag on the Go struct must appear as a property
//     in the spec schema. Catches a Go field that was added/renamed but never
//     documented (e.g. the historical content_kinds vs media_types drift).
//   - spec -> Go: every property declared in the spec schema must exist on
//     the Go struct. Catches a spec property that documents behaviour Go
//     never implements (e.g. BackendCapabilities.transitions/per_monitor/
//     daemon_process, which do not exist on backend.Capabilities).
//
// Coverage: only the TOP-LEVEL properties of each mapped schema are checked.
// Nested object/array item shapes are NOT expanded or verified — e.g.
// WallpaperCurrentResponse.monitors is checked for presence as a field, but
// the shape of each WallpaperCurrentSlot item is not; same for
// FolderListResponse/FolderPathResponse's `data` items (store.Folder).
// Schemas with `additionalProperties: true` and no `properties` (AppConfig,
// DaemonConfig, MonitorsConfig, WallhavenConfig, PatchConfigRequest,
// ConfigSectionDocument, ConfigSectionPatchBody, NamedBackendConfigBlob,
// GenericJSON) are intentionally loose passthroughs with no single backing Go
// type and are deliberately excluded from schemaTypes below — there is
// nothing to verify. StatusOk and NamedBackendPatchResponse are likewise
// excluded: both are tiny ad-hoc `map[string]string{"status": ...}` literals
// reused by several handlers, not backed by one dedicated struct.
package apispec_test

import (
	"os"
	"reflect"
	"sort"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/handler/backendshandler"
	"waypaper-engine/daemon/internal/handler/foldershandler"
	"waypaper-engine/daemon/internal/handler/healthhandler"
	"waypaper-engine/daemon/internal/handler/httpjson"
	"waypaper-engine/daemon/internal/handler/imageshandler"
	"waypaper-engine/daemon/internal/handler/playlistshandler"
	"waypaper-engine/daemon/internal/handler/wallpaperhandler"
)

// specPath is relative to this package (daemon/internal/apispec).
const specPath = "../../docs/openapi.yaml"

// schemaTypes maps an openapi.yaml components.schemas name to the Go type
// whose json tags define its actual wire shape. Deliberately explicit (not
// name-matched) so an added schema with no entry here fails loudly instead of
// silently going unchecked.
var schemaTypes = map[string]reflect.Type{
	"AutoPriorities":              reflect.TypeOf(config.AutoPriorities{}),
	"BackendSection":              reflect.TypeOf(config.BackendSection{}),
	"UnifiedConfig":               reflect.TypeOf(config.Config{}),
	"BackendCapabilities":         reflect.TypeOf(backend.Capabilities{}),
	"BackendInfo":                 reflect.TypeOf(backend.BackendInfo{}),
	"ActivateBackendResponse":     reflect.TypeOf(backendshandler.ActivateBackendResponse{}),
	"APIError":                    reflect.TypeOf(httpjson.APIError{}),
	"HealthzResponse":             reflect.TypeOf(healthhandler.HealthzResponse{}),
	"InfoResponse":                reflect.TypeOf(healthhandler.InfoResponse{}),
	"CapabilitiesResponse":        reflect.TypeOf(healthhandler.CapabilitiesResponse{}),
	"AddImagesResponse":           reflect.TypeOf(imageshandler.AddImagesResponse{}),
	"DeleteImagesResponse":        reflect.TypeOf(imageshandler.DeleteImagesResponse{}),
	"TagsResponse":                reflect.TypeOf(imageshandler.TagsResponse{}),
	"CancelImportResponse":        reflect.TypeOf(imageshandler.CancelImportResponse{}),
	"SelectAllResponse":           reflect.TypeOf(imageshandler.SelectAllResponse{}),
	"ExtractVideoPaletteResponse": reflect.TypeOf(imageshandler.ExtractVideoPaletteResponse{}),
	"ClearHistoryResponse":        reflect.TypeOf(wallpaperhandler.ClearHistoryResponse{}),
	"SetWallpaperResponse":        reflect.TypeOf(wallpaperhandler.SetWallpaperResponse{}),
	"RandomWallpaperResponse":     reflect.TypeOf(wallpaperhandler.RandomWallpaperResponse{}),
	"WallpaperCurrentResponse":    reflect.TypeOf(wallpaperhandler.WallpaperCurrentResponse{}),
	"StopAllResponse":             reflect.TypeOf(playlistshandler.StopAllResponse{}),
	"PauseAllResponse":            reflect.TypeOf(playlistshandler.PauseAllResponse{}),
	"ResumeAllResponse":           reflect.TypeOf(playlistshandler.ResumeAllResponse{}),
	"NextAllResponse":             reflect.TypeOf(playlistshandler.NextAllResponse{}),
	"PreviousAllResponse":         reflect.TypeOf(playlistshandler.PreviousAllResponse{}),
	"MoveImagesResponse":          reflect.TypeOf(foldershandler.MoveImagesResponse{}),
	"DeleteFolderResponse":        reflect.TypeOf(foldershandler.DeleteFolderResponse{}),
	"FolderPathResponse":          reflect.TypeOf(foldershandler.FolderPathResponse{}),
	"FolderListResponse":          reflect.TypeOf(foldershandler.FolderListResponse{}),
}

type specSchema struct {
	Properties map[string]any `yaml:"properties"`
}

type specDoc struct {
	Components struct {
		Schemas map[string]specSchema `yaml:"schemas"`
	} `yaml:"components"`
}

func loadSpec(t *testing.T) specDoc {
	t.Helper()
	raw, err := os.ReadFile(specPath)
	if err != nil {
		t.Fatalf("read %s: %v", specPath, err)
	}
	var doc specDoc
	if err := yaml.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("parse %s: %v", specPath, err)
	}
	return doc
}

// jsonFieldNames returns the top-level JSON property names a struct type
// serializes to, in json tag order. Anonymous/embedded fields are not
// expanded — none of the mapped types here use embedding.
func jsonFieldNames(t reflect.Type) []string {
	names := make([]string, 0, t.NumField())
	for i := 0; i < t.NumField(); i++ {
		tag := t.Field(i).Tag.Get("json")
		name, _, _ := strings.Cut(tag, ",")
		if name == "" || name == "-" {
			continue
		}
		names = append(names, name)
	}
	return names
}

// TestSchemasMatchGoStructs verifies, for every schema in schemaTypes, that
// the openapi.yaml properties and the Go struct's json tags name exactly the
// same top-level fields. See package doc for direction/coverage details.
func TestSchemasMatchGoStructs(t *testing.T) {
	doc := loadSpec(t)

	// Names in schemaTypes must exist in the spec, sorted for stable failure
	// ordering across runs so mismatches are unambiguous to grep in CI output.
	names := make([]string, 0, len(schemaTypes))
	for name := range schemaTypes {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, name := range names {
		typ := schemaTypes[name]
		schema, ok := doc.Components.Schemas[name]
		if !ok {
			t.Errorf("schemaTypes references %q but openapi.yaml has no such schema in components.schemas", name)
			continue
		}

		goFields := jsonFieldNames(typ)
		goSet := make(map[string]bool, len(goFields))
		for _, f := range goFields {
			goSet[f] = true
		}

		specSet := make(map[string]bool, len(schema.Properties))
		for p := range schema.Properties {
			specSet[p] = true
		}

		for _, f := range goFields {
			if !specSet[f] {
				t.Errorf("%s: openapi.yaml is missing field %q present on %s (json tag %q) — spec has drifted from the Go struct it documents", name, f, typ, f)
			}
		}
		for p := range schema.Properties {
			if !goSet[p] {
				t.Errorf("%s: openapi.yaml declares property %q that does not exist on %s — either the spec documents behaviour Go never implemented, or the Go struct lost a field", name, p, typ)
			}
		}
	}
}
