
package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "waypaper-engine-cli",
	Short: "A CLI for controlling the Waypaper Engine daemon",
	Run: func(cmd *cobra.Command, args []string) {
		// Do nothing
	},
}

// Execute executes the root command.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
