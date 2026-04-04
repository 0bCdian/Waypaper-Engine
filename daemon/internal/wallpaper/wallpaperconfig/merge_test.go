package wallpaperconfig

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMergeValues_DefaultsOnly(t *testing.T) {
	schema := []byte(`{"speed":{"type":"number","default":1.5},"flag":{"type":"bool","default":false}}`)
	got, err := MergeValues(schema, nil)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(got, &m))
	assert.Equal(t, float64(1.5), m["speed"])
	assert.Equal(t, false, m["flag"])
}

func TestMergeValues_Overrides(t *testing.T) {
	schema := []byte(`{"speed":{"type":"number","default":1},"tone":{"type":"string","default":"a"}}`)
	over := []byte(`{"speed":3,"tone":"b","unknown":99}`)
	got, err := MergeValues(schema, over)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(got, &m))
	assert.Equal(t, float64(3), m["speed"])
	assert.Equal(t, "b", m["tone"])
	_, hasUnknown := m["unknown"]
	assert.False(t, hasUnknown, "undefined schema keys must be ignored")
}

func TestMergeValues_EmptySchema(t *testing.T) {
	got, err := MergeValues(nil, []byte(`{"x":1}`))
	require.NoError(t, err)
	assert.Equal(t, "{}", string(got))
}
