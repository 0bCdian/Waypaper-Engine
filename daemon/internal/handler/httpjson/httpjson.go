package httpjson

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"waypaper-engine/daemon/internal/store"
)

// WriteJSON writes a JSON response with the given status code.
func WriteJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Error("failed to write JSON response", "error", err)
	}
}

// APIError is the standard error response format.
type APIError struct {
	Error     string         `json:"error"`
	Code      int            `json:"code"`
	Details   string         `json:"details,omitempty"`
	ErrorCode string         `json:"error_code,omitempty"`
	Meta      map[string]any `json:"meta,omitempty"`
}

// WriteError writes a JSON error response.
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, APIError{
		Error: message,
		Code:  status,
	})
}

// WriteErrorf writes a formatted JSON error response.
func WriteErrorf(w http.ResponseWriter, status int, format string, args ...any) {
	WriteError(w, status, fmt.Sprintf(format, args...))
}

// WriteStructuredError writes a JSON error with a machine-readable error_code and optional metadata.
func WriteStructuredError(w http.ResponseWriter, status int, errorCode string, message string, meta map[string]any) {
	WriteJSON(w, status, APIError{
		Error:     message,
		Code:      status,
		ErrorCode: errorCode,
		Meta:      meta,
	})
}

// ParseBody decodes a JSON request body into the target.
func ParseBody(r *http.Request, target any) error {
	if r.Body == nil {
		return fmt.Errorf("request body is empty")
	}
	defer r.Body.Close()
	if err := json.NewDecoder(r.Body).Decode(target); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}
	return nil
}

// ParseIntParam parses an integer from a URL path parameter.
func ParseIntParam(value string) (int, error) {
	n, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("invalid integer parameter %q: %w", value, err)
	}
	return n, nil
}

// WriteStoreError writes an appropriate HTTP error for a store operation failure.
// Returns 404 for ErrNotFound, 500 for everything else.
func WriteStoreError(w http.ResponseWriter, err error) {
	if errors.Is(err, store.ErrNotFound) {
		WriteError(w, http.StatusNotFound, err.Error())
	} else {
		WriteError(w, http.StatusInternalServerError, err.Error())
	}
}

// NormalizeStringSlice converts a []interface{} (from JSON decoding) to []string.
func NormalizeStringSlice(raw any) []string {
	arr, ok := raw.([]interface{})
	if !ok {
		return nil
	}
	out := make([]string, 0, len(arr))
	for _, v := range arr {
		if str, ok := v.(string); ok {
			out = append(out, str)
		}
	}
	return out
}

// PaginationParams holds parsed pagination query parameters.
type PaginationParams struct {
	Page      int
	PerPage   int
	SortBy    string
	SortOrder string
}

// ParsePagination extracts pagination parameters from query string.
func ParsePagination(r *http.Request) PaginationParams {
	q := r.URL.Query()

	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}

	perPage, _ := strconv.Atoi(q.Get("per_page"))
	if perPage < 1 {
		perPage = 50
	}
	if perPage > 200 {
		perPage = 200
	}

	sortBy := q.Get("sort_by")
	sortOrder := q.Get("sort_order")
	if sortOrder == "" {
		sortOrder = "desc"
	}

	return PaginationParams{
		Page:      page,
		PerPage:   perPage,
		SortBy:    sortBy,
		SortOrder: sortOrder,
	}
}
