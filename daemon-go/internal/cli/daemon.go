package cli

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"syscall"

	"github.com/spf13/cobra"
)

const (
	pidFile = "/tmp/waypaper-engine.pid"
)

var daemonCmd = &cobra.Command{
	Use:   "daemon",
	Short: "Manage the Waypaper Engine daemon",
}

var startCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the daemon",
	Run:   startDaemon,
}

var stopCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop the daemon",
	Run:   stopDaemon,
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Get the daemon status",
	Run:   getDaemonStatus,
}

func init() {
	rootCmd.AddCommand(daemonCmd)

daemonCmd.AddCommand(startCmd)

daemonCmd.AddCommand(stopCmd)

daemonCmd.AddCommand(statusCmd)
}

func startDaemon(cmd *cobra.Command, args []string) {
	if isDaemonRunning() {
		fmt.Println("Daemon is already running.")
		return
	}

	daemon := exec.Command(os.Args[0], "daemon", "run") // This will be the actual daemon command

daemon.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := daemon.Start(); err != nil {
		fmt.Printf("Failed to start daemon: %v\n", err)
		return
	}

	if err := os.WriteFile(pidFile, []byte(strconv.Itoa(daemon.Process.Pid)), 0644); err != nil {
		fmt.Printf("Failed to write pid file: %v\n", err)
		return
	}

	fmt.Printf("Daemon started with PID: %d\n", daemon.Process.Pid)
}

func stopDaemon(cmd *cobra.Command, args []string) {
	if !isDaemonRunning() {
		fmt.Println("Daemon is not running.")
		return
	}

	pid, err := getDaemonPID()
	if err != nil {
		fmt.Printf("Failed to get daemon PID: %v\n", err)
		return
	}

	if err := syscall.Kill(pid, syscall.SIGTERM); err != nil {
		fmt.Printf("Failed to stop daemon: %v\n", err)
		return
	}

	os.Remove(pidFile)
	fmt.Println("Daemon stopped.")
}

func getDaemonStatus(cmd *cobra.Command, args []string) {
	if isDaemonRunning() {
		pid, _ := getDaemonPID()
		fmt.Printf("Daemon is running with PID: %d\n", pid)
	} else {
		fmt.Println("Daemon is not running.")
	}
}

func isDaemonRunning() bool {
	pid, err := getDaemonPID()
	if err != nil {
		return false
	}

	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}

	err = process.Signal(syscall.Signal(0))
	return err == nil
}

func getDaemonPID() (int, error) {
	data, err := os.ReadFile(pidFile)
	if err != nil {
		return 0, err
	}

	return strconv.Atoi(string(data))
}
