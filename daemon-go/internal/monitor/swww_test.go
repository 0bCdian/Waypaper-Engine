
package monitor

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSwwwInit(t *testing.T) {
	// Create a mock runner
	mockRunner := &MockRunner{}
	manager := NewSwwwManager(mockRunner)

	// Case 1: swww is available
	mockRunner.SetOutput("", "", nil) // swww --version returns no error
	err := manager.SwwwInit()
	assert.NoError(t, err, "SwwwInit should not return an error if swww is available")

	// Case 2: swww is not available
	mockRunner.SetOutput("", "command not found", os.ErrNotExist)
	err = manager.SwwwInit()
	assert.Error(t, err, "SwwwInit should return an error if swww is not available")
}

func TestSetWallpaper(t *testing.T) {
	mockRunner := &MockRunner{}
	manager := NewSwwwManager(mockRunner)

	imagePath := "/path/to/wallpaper.jpg"
	monitorName := "DP-1"

	// Mock a successful run
	mockRunner.SetOutput("", "", nil)
	_, err := manager.SetWallpaper(imagePath, monitorName)

	assert.NoError(t, err, "SetWallpaper should not return an error on success")
	assert.Contains(t, mockRunner.GetLastCommand(), imagePath, "Command should contain the image path")
	assert.Contains(t, mockRunner.GetLastCommand(), monitorName, "Command should contain the monitor name")
}

func TestGetMonitors(t *testing.T) {
	mockRunner := &MockRunner{}
	manager := NewSwwwManager(mockRunner)

	// Mock the output of `swww query`
	mockOutput := `[{"name":"DP-1","modes":[{"width":1920,"height":1080}],"position":{"x":0,"y":0}},{"name":"HDMI-A-1","modes":[{"width":1920,"height":1080}],"position":{"x":1920,"y":0}}]`
	mockRunner.SetOutput(mockOutput, "", nil)

	monitors, err := manager.GetMonitors()
	assert.NoError(t, err, "GetMonitors should not return an error on success")
	assert.Len(t, monitors, 2, "Expected to parse 2 monitors")

	assert.Equal(t, "DP-1", monitors[0].Name, "First monitor name mismatch")
	assert.Equal(t, 1920, monitors[0].Width, "First monitor width mismatch")
	assert.Equal(t, 1080, monitors[0].Height, "First monitor height mismatch")

	assert.Equal(t, "HDMI-A-1", monitors[1].Name, "Second monitor name mismatch")
	assert.Equal(t, 1920, monitors[1].Width, "Second monitor width mismatch")
	assert.Equal(t, 1080, monitors[1].Height, "Second monitor height mismatch")
}

// MockRunner is a mock implementation of the CommandRunner for testing.
type MockRunner struct {
	lastCommand string
	stdout      string
	stderr      string
	err         error
}

func (m *MockRunner) Run(command string) (string, string, error) {
	m.lastCommand = command
	return m.stdout, m.stderr, m.err
}

func (m *MockRunner) SetOutput(stdout, stderr string, err error) {
	m.stdout = stdout
	m.stderr = stderr
	m.err = err
}

func (m *MockRunner) GetLastCommand() string {
	return m.lastCommand
}
