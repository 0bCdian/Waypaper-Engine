package walqt

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Regression: every transition rendered as fade because loadRequestToGenerated
// did not copy Transition / TransitionParams / Parallax / ImageFitMode /
// ImageRendering onto the generated LoadRequest, and the OpenAPI spec did not
// have those fields either. Once both were fixed, the over-the-wire JSON must
// contain the requested transition.
func TestLoadRequestToGenerated_PreservesTransitionAndFriends(t *testing.T) {
	in := loadRequest{
		Kind:           "image",
		Target:         "/tmp/walls/x.jpg",
		Transition:     "wipe",
		DurationMS:     250,
		ImageFitMode:   "cover",
		ImageRendering: "auto",
		TransitionParams: &transitionParamsBody{
			Bezier:               [4]float32{0.42, 0, 0.58, 1},
			AngleDeg:             180,
			OriginXPercent:       25,
			OriginYPercent:       75,
			WaveAmplitudePercent: 7,
			WaveFrequency:        3,
		},
		Parallax: map[string]any{
			"enabled":      true,
			"zoom":         float32(1.25),
			"step_percent": float32(6),
			"animation_ms": uint64(700),
			"reset_ms":     uint64(400),
			"easing":       []float32{0.4, 0, 0.2, 1},
		},
	}

	out := loadRequestToGenerated(in)

	require.NotNil(t, out.Transition, "transition must be copied onto the generated request")
	assert.Equal(t, "wipe", string(*out.Transition))

	require.NotNil(t, out.TransitionParams)
	require.NotNil(t, out.TransitionParams.AngleDeg)
	assert.Equal(t, float64(180), *out.TransitionParams.AngleDeg)
	require.NotNil(t, out.TransitionParams.Bezier)
	assert.Equal(t, []float32{0.42, 0, 0.58, 1}, *out.TransitionParams.Bezier)

	require.NotNil(t, out.ImageFitMode)
	assert.Equal(t, "cover", *out.ImageFitMode)
	require.NotNil(t, out.ImageRendering)
	assert.Equal(t, "auto", *out.ImageRendering)

	require.NotNil(t, out.Parallax, "parallax must be copied onto the generated request")
	require.NotNil(t, out.Parallax.Enabled)
	assert.True(t, *out.Parallax.Enabled)
	require.NotNil(t, out.Parallax.AnimationMs)
	assert.Equal(t, 700, *out.Parallax.AnimationMs)

	// The strongest end-to-end assertion: the JSON that goes over the socket
	// must carry the transition string the engine asked for.
	b, err := json.Marshal(out)
	require.NoError(t, err)
	assert.Contains(t, string(b), `"transition":"wipe"`)
	assert.Contains(t, string(b), `"image_fit_mode":"cover"`)
	assert.Contains(t, string(b), `"parallax":{`)
	assert.Contains(t, string(b), `"transition_params":{`)
}
