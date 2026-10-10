package wallpaperhandler

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"waypaper-engine/daemon/internal/store"
)

func TestStepHistory(t *testing.T) {
	// newest first, as GetRecent returns them
	entries := []store.ImageHistoryEntry{{ID: 9}, {ID: 7}, {ID: 4}}

	tests := []struct {
		name    string
		cur     int
		forward bool
		want    int // 0 = no entry
	}{
		{"previous from newest", 9, false, 7},
		{"previous skips gaps", 7, false, 4},
		{"previous at oldest", 4, false, 0},
		{"next from oldest", 4, true, 7},
		{"next at newest", 9, true, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := stepHistory(entries, tt.cur, tt.forward)
			if tt.want == 0 {
				assert.Nil(t, got)
				return
			}
			assert.Equal(t, tt.want, got.ID)
		})
	}
}
