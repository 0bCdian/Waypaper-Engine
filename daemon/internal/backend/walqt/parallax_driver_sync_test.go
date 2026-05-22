package walqt

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// The workspace parallax driver goroutine must be restarted when (and only when)
// a config field that the goroutine captures at start time changes. Restarting
// it on an unrelated change drops per-output workspace tracking and swallows the
// next workspace switch; never restarting it on a relevant change is the bug
// that left the Hyprland driver dead after a settings toggle.
func TestParallaxDriverSignature_RestartTriggers(t *testing.T) {
	base := defaultConfig()
	base.ParallaxEnabled = true

	t.Run("identical config yields identical signature", func(t *testing.T) {
		cfg := *base
		assert.Equal(t,
			parallaxDriverSignatureFromConfig(base),
			parallaxDriverSignatureFromConfig(&cfg),
		)
	})

	t.Run("toggling parallax_enabled changes the signature", func(t *testing.T) {
		off := *base
		off.ParallaxEnabled = false
		assert.NotEqual(t,
			parallaxDriverSignatureFromConfig(base),
			parallaxDriverSignatureFromConfig(&off),
		)
	})

	t.Run("changing the compositor driver mode changes the signature", func(t *testing.T) {
		hypr := *base
		hypr.ParallaxCompositorDriver = "hyprland"
		assert.NotEqual(t,
			parallaxDriverSignatureFromConfig(base),
			parallaxDriverSignatureFromConfig(&hypr),
		)
	})

	t.Run("changing the workspace chunk size changes the signature", func(t *testing.T) {
		chunk := *base
		chunk.ParallaxWorkspaceChunkSize = base.ParallaxWorkspaceChunkSize + 1
		assert.NotEqual(t,
			parallaxDriverSignatureFromConfig(base),
			parallaxDriverSignatureFromConfig(&chunk),
		)
	})
}

// Settings that the goroutine reads live (axis) or that ride along with the next
// load request (zoom, easing, step, timings) must not force a restart.
func TestParallaxDriverSignature_NoRestartForLiveSettings(t *testing.T) {
	base := defaultConfig()
	base.ParallaxEnabled = true

	cases := map[string]func(c *Config){
		"zoom":      func(c *Config) { c.ParallaxZoom = 175 },
		"step":      func(c *Config) { c.ParallaxStepPct = 12 },
		"animation": func(c *Config) { c.ParallaxAnimMS = 1234 },
		"reset":     func(c *Config) { c.ParallaxResetMS = 999 },
		"easing":    func(c *Config) { c.ParallaxEasing = "0.1,0.2,0.3,0.4" },
		"direction": func(c *Config) { c.ParallaxDirection = "vertical" },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			changed := *base
			mutate(&changed)
			assert.Equal(t,
				parallaxDriverSignatureFromConfig(base),
				parallaxDriverSignatureFromConfig(&changed),
				"%s is not captured by the driver goroutine and must not restart it", name,
			)
		})
	}
}

// The compositor driver mode is normalized so equivalent spellings ("", "auto")
// and casing differences do not register as a config change.
func TestParallaxDriverSignature_ModeNormalized(t *testing.T) {
	base := defaultConfig()
	base.ParallaxEnabled = true

	empty := *base
	empty.ParallaxCompositorDriver = ""
	auto := *base
	auto.ParallaxCompositorDriver = "auto"
	mixedCase := *base
	mixedCase.ParallaxCompositorDriver = "Hyprland"
	lowerCase := *base
	lowerCase.ParallaxCompositorDriver = "hyprland"

	assert.Equal(t,
		parallaxDriverSignatureFromConfig(&empty),
		parallaxDriverSignatureFromConfig(&auto),
		`"" and "auto" both mean ModeAuto`,
	)
	assert.Equal(t,
		parallaxDriverSignatureFromConfig(&mixedCase),
		parallaxDriverSignatureFromConfig(&lowerCase),
		"mode comparison is case-insensitive",
	)
}

// A nil config must fall back to defaults rather than panic.
func TestParallaxDriverSignature_NilConfig(t *testing.T) {
	assert.Equal(t,
		parallaxDriverSignatureFromConfig(defaultConfig()),
		parallaxDriverSignatureFromConfig(nil),
	)
}
