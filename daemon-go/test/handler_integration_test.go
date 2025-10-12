package test

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"waypaper-engine/daemon-go/internal/ipc"
	"waypaper-engine/daemon-go/internal/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestIPCHandlersIntegration tests all IPC handlers with real daemon
func TestIPCHandlersIntegration(t *testing.T) {
	// Skip if running in CI without display
	if os.Getenv("CI") == "true" && os.Getenv("DISPLAY") == "" {
		t.Skip("Skipping integration test in CI without display")
	}

	daemonPath, _ := buildBinaries(t)
	defer os.Remove(daemonPath)
	defer os.Remove(testDBPath)

	daemonCmd := startDaemon(t, daemonPath)
	defer stopDaemon(t, daemonCmd)

	// Create IPC client
	client, err := ipc.NewClient(defaultSocketPath)
	require.NoError(t, err)
	defer client.Close()

	// Test basic connectivity
	t.Run("TestPing", func(t *testing.T) {
		testPingHandler(t, client)
	})

	// Test daemon status
	t.Run("TestDaemonStatus", func(t *testing.T) {
		testDaemonStatusHandler(t, client)
	})

	// Test monitor handlers
	t.Run("TestMonitorHandlers", func(t *testing.T) {
		testMonitorHandlers(t, client)
	})

	// Test image processing handlers
	t.Run("TestImageProcessingHandlers", func(t *testing.T) {
		testImageProcessingHandlers(t, client)
	})

	// Test playlist handlers
	t.Run("TestPlaylistHandlers", func(t *testing.T) {
		testPlaylistHandlers(t, client)
	})

	// Test configuration handlers
	t.Run("TestConfigHandlers", func(t *testing.T) {
		testConfigHandlers(t, client)
	})
}

func testPingHandler(t *testing.T, client *ipc.Client) {
	msg := &ipc.Message{
		Action: "ping",
	}

	response, err := client.Send(msg)
	require.NoError(t, err)
	assert.Equal(t, "ping", response.Action)
	assert.Equal(t, "pong", response.Data)
	assert.Empty(t, response.Error)
}

func testDaemonStatusHandler(t *testing.T, client *ipc.Client) {
	msg := &ipc.Message{
		Action: "get_daemon_status",
	}

	response, err := client.Send(msg)
	require.NoError(t, err)
	assert.Equal(t, "get_daemon_status", response.Action)
	assert.Empty(t, response.Error)

	// Parse status data
	var status map[string]interface{}
	err = json.Unmarshal([]byte(fmt.Sprintf("%v", response.Data)), &status)
	require.NoError(t, err)

	// Check required status fields
	assert.Contains(t, status, "running")
	assert.Contains(t, status, "uptime")
	assert.Contains(t, status, "version")
}

func testMonitorHandlers(t *testing.T, client *ipc.Client) {
	// Test get monitors
	msg := &ipc.Message{
		Action: "get_monitors",
	}

	response, err := client.Send(msg)
	require.NoError(t, err)
	assert.Equal(t, "get_monitors", response.Action)
	assert.Empty(t, response.Error)

	// Parse monitors data
	var monitors []map[string]interface{}
	err = json.Unmarshal([]byte(fmt.Sprintf("%v", response.Data)), &monitors)
	require.NoError(t, err)

	// Should have at least one monitor
	assert.GreaterOrEqual(t, len(monitors), 1)

	// Test set/get selected monitor if we have monitors
	if len(monitors) > 0 {
		monitorName := monitors[0]["name"].(string)

		// Test set selected monitor
		setMsg := &ipc.Message{
			Action:      "set_selected_monitor",
			MonitorName: monitorName,
		}

		setResponse, err := client.Send(setMsg)
		require.NoError(t, err)
		assert.Equal(t, "set_selected_monitor", setResponse.Action)
		assert.Empty(t, setResponse.Error)

		// Test get selected monitor
		getMsg := &ipc.Message{
			Action: "get_selected_monitor",
		}

		getResponse, err := client.Send(getMsg)
		require.NoError(t, err)
		assert.Equal(t, "get_selected_monitor", getResponse.Action)
		assert.Empty(t, getResponse.Error)
	}
}

func testImageProcessingHandlers(t *testing.T, client *ipc.Client) {
	// Get test image paths
	testImagePaths := getTestImagePaths(t)
	require.GreaterOrEqual(t, len(testImagePaths), 1, "Need at least one test image")

	// Test process_images (our new parallel processor!)
	t.Run("TestProcessImages", func(t *testing.T) {
		testProcessImagesHandler(t, client, testImagePaths)
	})

	// Test get images
	t.Run("TestGetImages", func(t *testing.T) {
		testGetImagesHandler(t, client)
	})

	// Test image source handlers
	t.Run("TestImageSourceHandlers", func(t *testing.T) {
		testImageSourceHandlers(t, client)
	})

	// Test image deletion
	t.Run("TestImageDeletion", func(t *testing.T) {
		testImageDeletionHandlers(t, client)
	})
}

func testProcessImagesHandler(t *testing.T, client *ipc.Client, testImagePaths []string) {
	// Prepare image paths and names
	var imagePaths []string
	var fileNames []string

	for i, path := range testImagePaths {
		imagePaths = append(imagePaths, path)
		fileNames = append(fileNames, fmt.Sprintf("test_image_%d.png", i+1))
	}

	msg := &ipc.Message{
		Action:     "process_images",
		ImagePaths: imagePaths,
		FileNames:  fileNames,
	}

	startTime := time.Now()
	response, err := client.Send(msg)
	processingTime := time.Since(startTime)

	require.NoError(t, err)
	assert.Equal(t, "process_images", response.Action)
	assert.Empty(t, response.Error)

	// Parse metadata list
	var metadataList []map[string]interface{}
	err = json.Unmarshal([]byte(fmt.Sprintf("%v", response.Data)), &metadataList)
	require.NoError(t, err)

	// Should have processed all images
	assert.Equal(t, len(testImagePaths), len(metadataList))

	// Check metadata structure
	for i, metadata := range metadataList {
		assert.Contains(t, metadata, "width")
		assert.Contains(t, metadata, "height")
		assert.Contains(t, metadata, "format")
		assert.Equal(t, fmt.Sprintf("test_image_%d.png", i+1), metadata["name"])
	}

	// Log performance metrics
	t.Logf("Processed %d images in %v (parallel processing)", len(testImagePaths), processingTime)
	t.Logf("Average time per image: %v", processingTime/time.Duration(len(testImagePaths)))
}

func testGetImagesHandler(t *testing.T, client *ipc.Client) {
	msg := &ipc.Message{
		Action: "get_images",
	}

	response, err := client.Send(msg)
	require.NoError(t, err)
	assert.Equal(t, "get_images", response.Action)
	assert.Empty(t, response.Error)

	// Parse images data
	var images []map[string]interface{}
	err = json.Unmarshal([]byte(fmt.Sprintf("%v", response.Data)), &images)
	require.NoError(t, err)

	// Should have images from our previous test
	assert.GreaterOrEqual(t, len(images), 1)

	// Check image structure
	if len(images) > 0 {
		image := images[0]
		assert.Contains(t, image, "id")
		assert.Contains(t, image, "name")
		assert.Contains(t, image, "width")
		assert.Contains(t, image, "height")
		assert.Contains(t, image, "format")
	}
}

func testImageSourceHandlers(t *testing.T, client *ipc.Client) {
	// First get images to have something to test with
	getMsg := &ipc.Message{
		Action: "get_images",
	}

	getResponse, err := client.Send(getMsg)
	require.NoError(t, err)

	var images []map[string]interface{}
	err = json.Unmarshal([]byte(fmt.Sprintf("%v", getResponse.Data)), &images)
	require.NoError(t, err)

	if len(images) == 0 {
		t.Skip("No images available for source testing")
	}

	imageID := images[0]["id"]

	// Test get_image_src
	srcMsg := &ipc.Message{
		Action: "get_image_src",
		Image: &ipc.ImageInfo{
			ID: int64(imageID.(float64)),
		},
	}

	srcResponse, err := client.Send(srcMsg)
	require.NoError(t, err)
	assert.Equal(t, "get_image_src", srcResponse.Action)
	assert.Empty(t, srcResponse.Error)

	// Test get_thumbnail_src
	thumbMsg := &ipc.Message{
		Action: "get_thumbnail_src",
		Image: &ipc.ImageInfo{
			ID: int64(imageID.(float64)),
		},
	}

	thumbResponse, err := client.Send(thumbMsg)
	require.NoError(t, err)
	assert.Equal(t, "get_thumbnail_src", thumbResponse.Action)
	assert.Empty(t, thumbResponse.Error)
}

func testImageDeletionHandlers(t *testing.T, client *ipc.Client) {
	// First get images to have something to delete
	getMsg := &ipc.Message{
		Action: "get_images",
	}

	getResponse, err := client.Send(getMsg)
	require.NoError(t, err)

	var images []map[string]interface{}
	err = json.Unmarshal([]byte(fmt.Sprintf("%v", getResponse.Data)), &images)
	require.NoError(t, err)

	if len(images) == 0 {
		t.Skip("No images available for deletion testing")
	}

	// Test delete_image_from_gallery
	deleteMsg := &ipc.Message{
		Action:   "delete_image_from_gallery",
		ImageIDs: []int64{int64(images[0]["id"].(float64))},
	}

	deleteResponse, err := client.Send(deleteMsg)
	require.NoError(t, err)
	assert.Equal(t, "delete_image_from_gallery", deleteResponse.Action)
	assert.Empty(t, deleteResponse.Error)
}

func testPlaylistHandlers(t *testing.T, client *ipc.Client) {
	// Test get playlists
	getMsg := &ipc.Message{
		Action: "get_playlists",
	}

	getResponse, err := client.Send(getMsg)
	require.NoError(t, err)
	assert.Equal(t, "get_playlists", getResponse.Action)
	assert.Empty(t, getResponse.Error)

	// Test get active playlist
	activeMsg := &ipc.Message{
		Action: "get_active_playlist",
	}

	activeResponse, err := client.Send(activeMsg)
	require.NoError(t, err)
	assert.Equal(t, "get_active_playlist", activeResponse.Action)
	assert.Empty(t, activeResponse.Error)

	// Test playlist operations with a test playlist
	testPlaylistOperations(t, client)
}

func testPlaylistOperations(t *testing.T, client *ipc.Client) {
	// Get monitors for playlist operations
	monitorMsg := &ipc.Message{
		Action: "get_monitors",
	}

	monitorResponse, err := client.Send(monitorMsg)
	require.NoError(t, err)

	var monitors []map[string]interface{}
	err = json.Unmarshal([]byte(fmt.Sprintf("%v", monitorResponse.Data)), &monitors)
	require.NoError(t, err)

	if len(monitors) == 0 {
		t.Skip("No monitors available for playlist testing")
	}

	monitorName := monitors[0]["name"].(string)

	// Test playlist operations
	activeMonitor := &models.ActiveMonitor{
		Name: monitorName,
		Monitors: []models.Monitor{
			{
				Name:   monitorName,
				Width:  1920,
				Height: 1080,
				Position: models.Position{
					X: 0,
					Y: 0,
				},
			},
		},
		ExtendAcrossMonitors: false,
	}

	// Test next_image
	nextMsg := &ipc.Message{
		Action:        "next_image",
		ActiveMonitor: activeMonitor,
	}

	nextResponse, err := client.Send(nextMsg)
	require.NoError(t, err)
	assert.Equal(t, "next_image", nextResponse.Action)

	// Test previous_image
	prevMsg := &ipc.Message{
		Action:        "previous_image",
		ActiveMonitor: activeMonitor,
	}

	prevResponse, err := client.Send(prevMsg)
	require.NoError(t, err)
	assert.Equal(t, "previous_image", prevResponse.Action)

	// Test random_image
	randomMsg := &ipc.Message{
		Action:        "random_image",
		ActiveMonitor: activeMonitor,
	}

	randomResponse, err := client.Send(randomMsg)
	require.NoError(t, err)
	assert.Equal(t, "random_image", randomResponse.Action)
}

func testConfigHandlers(t *testing.T, client *ipc.Client) {
	// Test get_app_config
	getMsg := &ipc.Message{
		Action: "get_app_config",
	}

	getResponse, err := client.Send(getMsg)
	require.NoError(t, err)
	assert.Equal(t, "get_app_config", getResponse.Action)
	assert.Empty(t, getResponse.Error)

	// Test set_app_config
	setMsg := &ipc.Message{
		Action: "set_app_config",
		Config: &ipc.ConfigData{
			ConfigKey:   "setting",
			ConfigValue: "test_value",
		},
	}

	setResponse, err := client.Send(setMsg)
	require.NoError(t, err)
	assert.Equal(t, "set_app_config", setResponse.Action)
	assert.Empty(t, setResponse.Error)
}

func getTestImagePaths(t *testing.T) []string {
	testDir := "test_images"
	var imagePaths []string

	// Check if test images directory exists
	if _, err := os.Stat(testDir); os.IsNotExist(err) {
		t.Skipf("Test images directory %s does not exist", testDir)
	}

	// Find all image files
	files, err := os.ReadDir(testDir)
	require.NoError(t, err)

	for _, file := range files {
		if !file.IsDir() {
			ext := filepath.Ext(file.Name())
			if ext == ".png" || ext == ".jpg" || ext == ".jpeg" {
				fullPath := filepath.Join(testDir, file.Name())
				imagePaths = append(imagePaths, fullPath)
			}
		}
	}

	return imagePaths
}

// TestParallelImageProcessingPerformance tests the performance of our new parallel processor
func TestParallelImageProcessingPerformance(t *testing.T) {
	// Skip if running in CI without display
	if os.Getenv("CI") == "true" && os.Getenv("DISPLAY") == "" {
		t.Skip("Skipping performance test in CI without display")
	}

	daemonPath, _ := buildBinaries(t)
	defer os.Remove(daemonPath)
	defer os.Remove(testDBPath)

	daemonCmd := startDaemon(t, daemonPath)
	defer stopDaemon(t, daemonCmd)

	client, err := ipc.NewClient(defaultSocketPath)
	require.NoError(t, err)
	defer client.Close()

	testImagePaths := getTestImagePaths(t)
	require.GreaterOrEqual(t, len(testImagePaths), 3, "Need at least 3 test images for performance testing")

	// Test with different batch sizes
	batchSizes := []int{1, 2, 3}

	for _, batchSize := range batchSizes {
		if batchSize > len(testImagePaths) {
			continue
		}

		t.Run(fmt.Sprintf("BatchSize_%d", batchSize), func(t *testing.T) {
			var imagePaths []string
			var fileNames []string

			for i := 0; i < batchSize; i++ {
				imagePaths = append(imagePaths, testImagePaths[i])
				fileNames = append(fileNames, fmt.Sprintf("perf_test_%d_%d.png", batchSize, i+1))
			}

			msg := &ipc.Message{
				Action:     "process_images",
				ImagePaths: imagePaths,
				FileNames:  fileNames,
			}

			startTime := time.Now()
			response, err := client.Send(msg)
			processingTime := time.Since(startTime)

			require.NoError(t, err)
			assert.Equal(t, "process_images", response.Action)
			assert.Empty(t, response.Error)

			// Calculate performance metrics
			avgTimePerImage := processingTime / time.Duration(batchSize)

			t.Logf("Batch size: %d, Total time: %v, Avg per image: %v",
				batchSize, processingTime, avgTimePerImage)

			// Performance assertions
			assert.Less(t, processingTime, 30*time.Second, "Processing should complete within 30 seconds")
			assert.Less(t, avgTimePerImage, 10*time.Second, "Average time per image should be under 10 seconds")
		})
	}
}

// TestImageProcessingErrorHandling tests error handling in image processing
func TestImageProcessingErrorHandling(t *testing.T) {
	// Skip if running in CI without display
	if os.Getenv("CI") == "true" && os.Getenv("DISPLAY") == "" {
		t.Skip("Skipping error handling test in CI without display")
	}

	daemonPath, _ := buildBinaries(t)
	defer os.Remove(daemonPath)
	defer os.Remove(testDBPath)

	daemonCmd := startDaemon(t, daemonPath)
	defer stopDaemon(t, daemonCmd)

	client, err := ipc.NewClient(defaultSocketPath)
	require.NoError(t, err)
	defer client.Close()

	// Test with invalid image paths
	msg := &ipc.Message{
		Action:     "process_images",
		ImagePaths: []string{"/nonexistent/image1.png", "/nonexistent/image2.png"},
		FileNames:  []string{"invalid1.png", "invalid2.png"},
	}

	response, err := client.Send(msg)
	require.NoError(t, err)
	assert.Equal(t, "process_images", response.Action)

	// Should handle errors gracefully
	var metadataList []map[string]interface{}
	err = json.Unmarshal([]byte(fmt.Sprintf("%v", response.Data)), &metadataList)
	require.NoError(t, err)

	// Should return empty list for invalid images
	assert.Equal(t, 0, len(metadataList))
}

// TestMultiMonitorImageOperations tests image operations across multiple monitors
func TestMultiMonitorImageOperations(t *testing.T) {
	// Skip if running in CI without display
	if os.Getenv("CI") == "true" && os.Getenv("DISPLAY") == "" {
		t.Skip("Skipping multi-monitor test in CI without display")
	}

	daemonPath, _ := buildBinaries(t)
	defer os.Remove(daemonPath)
	defer os.Remove(testDBPath)

	daemonCmd := startDaemon(t, daemonPath)
	defer stopDaemon(t, daemonCmd)

	client, err := ipc.NewClient(defaultSocketPath)
	require.NoError(t, err)
	defer client.Close()

	// Get monitors
	monitorMsg := &ipc.Message{
		Action: "get_monitors",
	}

	monitorResponse, err := client.Send(monitorMsg)
	require.NoError(t, err)

	var monitors []map[string]interface{}
	err = json.Unmarshal([]byte(fmt.Sprintf("%v", monitorResponse.Data)), &monitors)
	require.NoError(t, err)

	if len(monitors) < 2 {
		t.Skip("Need at least 2 monitors for multi-monitor testing")
	}

	// Test set_image_across_monitors
	activeMonitor := &models.ActiveMonitor{
		Name: "*",
		Monitors: []models.Monitor{
			{
				Name:   monitors[0]["name"].(string),
				Width:  1920,
				Height: 1080,
				Position: models.Position{
					X: 0,
					Y: 0,
				},
			},
			{
				Name:   monitors[1]["name"].(string),
				Width:  1920,
				Height: 1080,
				Position: models.Position{
					X: 1920,
					Y: 0,
				},
			},
		},
		ExtendAcrossMonitors: true,
	}

	// First process an image
	testImagePaths := getTestImagePaths(t)
	if len(testImagePaths) == 0 {
		t.Skip("No test images available")
	}

	processMsg := &ipc.Message{
		Action:     "process_images",
		ImagePaths: []string{testImagePaths[0]},
		FileNames:  []string{"multi_monitor_test.png"},
	}

	processResponse, err := client.Send(processMsg)
	require.NoError(t, err)

	var metadataList []map[string]interface{}
	err = json.Unmarshal([]byte(fmt.Sprintf("%v", processResponse.Data)), &metadataList)
	require.NoError(t, err)

	if len(metadataList) == 0 {
		t.Skip("No images processed successfully")
	}

	// Test set_image_across_monitors
	setMsg := &ipc.Message{
		Action:        "set_image_across_monitors",
		ActiveMonitor: activeMonitor,
		Image: &ipc.ImageInfo{
			ID: int64(metadataList[0]["width"].(float64)), // Using width as ID placeholder
		},
	}

	setResponse, err := client.Send(setMsg)
	require.NoError(t, err)
	assert.Equal(t, "set_image_across_monitors", setResponse.Action)

	// Test duplicate_image_across_monitors
	dupMsg := &ipc.Message{
		Action:        "duplicate_image_across_monitors",
		ActiveMonitor: activeMonitor,
		Image: &ipc.ImageInfo{
			ID: int64(metadataList[0]["width"].(float64)), // Using width as ID placeholder
		},
	}

	dupResponse, err := client.Send(dupMsg)
	require.NoError(t, err)
	assert.Equal(t, "duplicate_image_across_monitors", dupResponse.Action)
}
