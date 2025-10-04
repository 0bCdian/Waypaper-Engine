package test

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/ipc"
	"waypaper-engine/daemon-go/internal/monitor"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	daemonBinaryName = "waypaper-engine-daemon"
	cliBinaryName    = "waypaper-engine-cli"
	testDBPath       = "test.db"
)

func buildBinaries(t *testing.T) (string, string) {
	// Build daemon binary
	daemonCmd := exec.Command("go", "build", "-o", daemonBinaryName, "./cmd/daemon")
	daemonCmd.Dir = "../"
	output, err := daemonCmd.CombinedOutput()
	require.NoError(t, err, fmt.Sprintf("failed to build daemon: %s", output))

	// Build CLI binary
	cliCmd := exec.Command("go", "build", "-o", cliBinaryName, "./cmd/cli")
	cliCmd.Dir = "../"
	output, err = cliCmd.CombinedOutput()
	require.NoError(t, err, fmt.Sprintf("failed to build cli: %s", output))

	daemonPath := filepath.Join("../", daemonBinaryName)
	cliPath := filepath.Join("../", cliBinaryName)

	return daemonPath, cliPath
}

func startDaemon(t *testing.T, daemonPath string) *exec.Cmd {
	cmd := exec.Command(daemonPath)
	cmd.Env = append(os.Environ(), fmt.Sprintf("WAYPAPER_DB_PATH=%s", testDBPath))
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err := cmd.Start()
	require.NoError(t, err, "failed to start daemon process")

	// Give daemon some time to start and create socket
	time.Sleep(2 * time.Second)

	return cmd
}

func stopDaemon(t *testing.T, cmd *exec.Cmd) {
	if cmd != nil && cmd.Process != nil {
		cmd.Process.Signal(os.Interrupt)
		cmd.Wait()
	}
	os.Remove(ipc.SocketPath)
	os.Remove(testDBPath)
}

func TestDaemonLifecycle(t *testing.T) {
	daemonPath, _ := buildBinaries(t)
	defer os.Remove(daemonPath)
	defer os.Remove(testDBPath)

	daemonCmd := startDaemon(t, daemonPath)
	assert.NotNil(t, daemonCmd.Process)

	// Try connecting to IPC to ensure it's up
	client, err := ipc.NewClient()
	assert.NoError(t, err)
	client.Close()

	stopDaemon(t, daemonCmd)
	// Verify socket is removed
	_, err = os.Stat(ipc.SocketPath)
	assert.True(t, os.IsNotExist(err))
}

func TestPlaylistWorkflow(t *testing.T) {
	daemonPath, cliPath := buildBinaries(t)
	defer os.Remove(daemonPath)
	defer os.Remove(cliPath)
	defer os.Remove(testDBPath)

	daemonCmd := startDaemon(t, daemonPath)
	defer stopDaemon(t, daemonCmd)

	// Use CLI to create a playlist (this would ideally be done via IPC directly)
	// For simplicity, we'll assume a playlist named "default" exists or is created.
	// In a real integration test, you'd populate the DB directly or use a setup command.

	// Simulate creating a playlist and adding images via direct DB access for testing setup
	dbManager, err := db.NewDatabaseManager(testDBPath, db.DefaultPoolConfig())
	require.NoError(t, err)
	defer dbManager.Close()
	require.NoError(t, dbManager.Initialize(context.Background()))
	dbOps := db.NewDatabaseOperations(dbManager)

	images := []db.Image{
		{Name: "/path/to/image1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
		{Name: "/path/to/image2.png", Width: 1280, Height: 720, Format: "png"},
	}
	insertedImages, err := dbOps.InsertImagesBatch(context.Background(), []db.BatchImageInsert{
		{Name: "/path/to/image1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
		{Name: "/path/to/image2.png", Width: 1280, Height: 720, Format: "png"},
	})
	require.NoError(t, err)
	for i := range images {
		images[i].ID = insertedImages[i].ID
	}

	pl := db.Playlist{
		Name:                    "my_playlist",
		Type:                    "timer",
		Interval:                sql.NullInt64{Int64: 1, Valid: true},
		Showanimations:          1,
		Alwaysstartonfirstimage: 0,
		Order:                   sql.NullString{String: "ordered", Valid: true},
		Currentimageindex:       0,
	}
	_, err = dbOps.UpsertPlaylistWithImages(context.Background(), pl, images)
	require.NoError(t, err)

	// Simulate a monitor
	activeMonitor := &monitor.ActiveMonitor{Name: "eDP-1", Monitors: []monitor.Monitor{{Name: "eDP-1"}}}

	// Start playlist via CLI
	startCmd := exec.Command(cliPath, "playlist", "start", "my_playlist", activeMonitor.Name)
	output, err := startCmd.CombinedOutput()
	require.NoError(t, err, fmt.Sprintf("CLI start failed: %s", output))
	assert.Contains(t, string(output), "playlist started")

	// Wait for an image change (due to timer)
	time.Sleep(1 * time.Minute)

	// Check current image index (requires direct DB access or a daemon IPC for status)
	retrievedPlaylist, err := dbOps.GetPlaylistWithImages(context.Background(), "my_playlist")
	require.NoError(t, err)
	assert.Equal(t, int64(1), retrievedPlaylist.Playlist.Currentimageindex)

	// Stop playlist via CLI
	stopCmd := exec.Command(cliPath, "playlist", "stop", activeMonitor.Name)
	output, err = stopCmd.CombinedOutput()
	require.NoError(t, err, fmt.Sprintf("CLI stop failed: %s", output))
	assert.Contains(t, string(output), "playlist stopped")
}
