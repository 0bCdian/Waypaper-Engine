package walqtclient

// Run `make sync-walqt-spec` from the waypaper-engine repo root (or `go generate ./...`
// from daemon/) to regenerate client.gen.go from the vendored OpenAPI spec.
//
//go:generate go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen --config=oapi-codegen.yaml ../openapi/wal-qt.yaml
