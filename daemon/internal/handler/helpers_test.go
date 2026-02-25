package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWriteJSON(t *testing.T) {
	w := httptest.NewRecorder()
	WriteJSON(w, http.StatusCreated, map[string]string{"hello": "world"})

	assert.Equal(t, http.StatusCreated, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
	assert.JSONEq(t, `{"hello":"world"}`, w.Body.String())
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	WriteError(w, http.StatusBadRequest, "something went wrong")

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var apiErr APIError
	require.NoError(t, json.NewDecoder(w.Body).Decode(&apiErr))
	assert.Equal(t, "something went wrong", apiErr.Error)
	assert.Equal(t, http.StatusBadRequest, apiErr.Code)
}

func TestParseBody_Valid(t *testing.T) {
	body := strings.NewReader(`{"name":"test","value":42}`)
	r := httptest.NewRequest(http.MethodPost, "/", body)

	var target struct {
		Name  string `json:"name"`
		Value int    `json:"value"`
	}
	require.NoError(t, ParseBody(r, &target))
	assert.Equal(t, "test", target.Name)
	assert.Equal(t, 42, target.Value)
}

func TestParseBody_Invalid(t *testing.T) {
	body := strings.NewReader(`{not valid json}`)
	r := httptest.NewRequest(http.MethodPost, "/", body)

	var target map[string]any
	err := ParseBody(r, &target)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid JSON")
}

func TestParseBody_NilBody(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/", nil)
	r.Body = nil

	var target map[string]any
	err := ParseBody(r, &target)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "empty")
}

func TestParseIntParam_Valid(t *testing.T) {
	n, err := ParseIntParam("42")
	require.NoError(t, err)
	assert.Equal(t, 42, n)
}

func TestParseIntParam_Invalid(t *testing.T) {
	_, err := ParseIntParam("abc")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid integer")
}

func TestParsePagination_Defaults(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/items", nil)
	p := ParsePagination(r)

	assert.Equal(t, 1, p.Page)
	assert.Equal(t, 50, p.PerPage)
	assert.Equal(t, "desc", p.SortOrder)
	assert.Empty(t, p.SortBy)
}

func TestParsePagination_Custom(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/items?page=3&per_page=20&sort_by=name&sort_order=asc", nil)
	p := ParsePagination(r)

	assert.Equal(t, 3, p.Page)
	assert.Equal(t, 20, p.PerPage)
	assert.Equal(t, "name", p.SortBy)
	assert.Equal(t, "asc", p.SortOrder)
}

func TestParsePagination_Clamps(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/items?page=-1&per_page=999", nil)
	p := ParsePagination(r)

	assert.Equal(t, 1, p.Page)
	assert.Equal(t, 200, p.PerPage)
}
