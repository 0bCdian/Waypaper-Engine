package waylandutauri

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseTransitionBezierOrDefault(t *testing.T) {
	got := parseTransitionBezierOrDefault("0.1, 0.2 ,0.3,1")
	assert.Equal(t, [4]float32{0.1, 0.2, 0.3, 1}, got)

	got = parseTransitionBezierOrDefault("")
	assert.Equal(t, defaultTransitionBezier, got)

	got = parseTransitionBezierOrDefault("not,numbers")
	assert.Equal(t, defaultTransitionBezier, got)

	got = parseTransitionBezierOrDefault("1,2,3")
	assert.Equal(t, defaultTransitionBezier, got)
}

func TestParseTransitionBezierStrict(t *testing.T) {
	got, err := parseTransitionBezierStrict("0.54,0,0.34,0.99")
	require.NoError(t, err)
	assert.Equal(t, defaultTransitionBezier, got)

	_, err = parseTransitionBezierStrict("")
	require.Error(t, err)

	_, err = parseTransitionBezierStrict("1,2,3")
	require.Error(t, err)

	_, err = parseTransitionBezierStrict("nan,0,0,1")
	require.Error(t, err)
}

func TestWaylandUtauri_ValidateConfig_TransitionBezier(t *testing.T) {
	b := &WaylandUtauri{}

	err := b.ValidateConfig(json.RawMessage(`{"transition_bezier":"0,0,1,1"}`))
	require.NoError(t, err)

	err = b.ValidateConfig(json.RawMessage(`{}`))
	require.NoError(t, err)

	err = b.ValidateConfig(json.RawMessage(`{"transition_bezier":"bad"}`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "transition_bezier")

	err = b.ValidateConfig(json.RawMessage(`not-json`))
	require.Error(t, err)
}
