package handler

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseColorsNearQuery(t *testing.T) {
	got := parseColorsNearQuery("  #ff0000~10 , #00ff00~2.5 ")
	require.Len(t, got, 2)
	assert.Equal(t, "#ff0000", got[0].Hex)
	assert.Equal(t, 10.0, got[0].MaxDeltaE)
	assert.Equal(t, "#00ff00", got[1].Hex)
	assert.Equal(t, 2.5, got[1].MaxDeltaE)
}

func TestParseColorsNearQuery_skipsInvalid(t *testing.T) {
	got := parseColorsNearQuery("#abc~not, ntilde, #fff~-1")
	assert.Len(t, got, 0)
}
