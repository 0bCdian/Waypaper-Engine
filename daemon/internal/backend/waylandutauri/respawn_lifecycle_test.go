package waylandutauri

import (
	"testing"
	"time"
)

func TestRespawnAfterChildExit_SkipsWhenRespawnDisallowed(t *testing.T) {
	w := &WaylandUtauri{}
	w.allowManagedChildRespawn.Store(false)

	done := make(chan struct{})
	go func() {
		w.respawnAfterChildExit(0)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("respawnAfterChildExit should return immediately when respawn is disallowed")
	}
}
