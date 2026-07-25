package walqt

import (
	"os"
	"reflect"
	"regexp"
	"strings"
	"testing"

	"waypaper-engine/daemon/internal/backend"
)

// TestCapabilitiesMatchOpenAPISpec guards against the spec and the Go struct
// silently drifting apart on field names (this happened with media_types vs
// content_kinds — the ci:types check only diffs the generated TS file against
// the spec, never the spec against the Go struct that actually produces the
// JSON, so a rename on one side can go unnoticed forever). It fails if any
// json tag on backend.Capabilities is missing from the BackendCapabilities
// schema in daemon/docs/openapi.yaml.
func TestCapabilitiesMatchOpenAPISpec(t *testing.T) {
	raw, err := os.ReadFile("../../../docs/openapi.yaml")
	if err != nil {
		t.Fatalf("read openapi.yaml: %v", err)
	}
	spec := string(raw)

	const marker = "BackendCapabilities:"
	start := strings.Index(spec, marker)
	if start == -1 {
		t.Fatalf("openapi.yaml: %s schema not found", marker)
	}
	block := spec[start+len(marker):]
	// The schema block ends at the next sibling key under `schemas:`, i.e. a
	// line indented exactly like BackendCapabilities (4 spaces + name + ':',
	// not the more deeply indented `properties:` entries within the block).
	if loc := regexp.MustCompile(`\n {4}\S`).FindStringIndex(block); loc != nil {
		block = block[:loc[0]]
	}

	typ := reflect.TypeOf(backend.Capabilities{})
	for i := 0; i < typ.NumField(); i++ {
		tag := typ.Field(i).Tag.Get("json")
		name, _, _ := strings.Cut(tag, ",")
		if name == "" || name == "-" {
			continue
		}
		if !strings.Contains(block, name+":") {
			t.Errorf("openapi.yaml BackendCapabilities schema is missing field %q present on backend.Capabilities (json tag %q) — spec has drifted from the Go struct it documents", name, tag)
		}
	}
}
