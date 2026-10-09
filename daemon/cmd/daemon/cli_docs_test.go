package main

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

const cliDocsPath = "../../../docs/reference/cli.md"

func cell(s string) string { return strings.ReplaceAll(s, "|", `\|`) }

func flagTable(b *strings.Builder, fs *pflag.FlagSet) {
	rows := ""
	fs.VisitAll(func(f *pflag.Flag) {
		if f.Hidden {
			return
		}
		short := ""
		if f.Shorthand != "" {
			short = "`-" + f.Shorthand + "`"
		}
		def := ""
		if f.DefValue != "" {
			def = "`" + f.DefValue + "`"
		}
		rows += fmt.Sprintf("| `--%s` | %s | %s | %s |\n", f.Name, short, cell(def), cell(f.Usage))
	})
	if rows != "" {
		b.WriteString("| Flag | Shorthand | Default | Description |\n| --- | --- | --- | --- |\n" + rows + "\n")
	}
}

func renderCLIDocs(root *cobra.Command) string {
	var b strings.Builder
	b.WriteString("# CLI reference\n\n")
	b.WriteString("`waypaper-daemon` with no subcommand runs the daemon. Subcommands talk to a running daemon over its Unix socket. The global `--json` flag prints raw JSON for scripting.\n\n")
	b.WriteString("## Global flags\n\n")
	flagTable(&b, root.PersistentFlags())

	var walk func(c *cobra.Command)
	walk = func(c *cobra.Command) {
		// The root is covered by the intro and the global flags table.
		if c != root {
			desc := c.Short
			if c.Long != "" {
				desc = c.Long
			}
			fmt.Fprintf(&b, "## %s\n\n```sh\n%s\n```\n\n%s\n\n", c.CommandPath(), c.UseLine(), desc)
			if len(c.Aliases) > 0 {
				b.WriteString("Aliases: `" + strings.Join(c.Aliases, "`, `") + "`\n\n")
			}
			flagTable(&b, c.LocalFlags())
		}
		for _, sub := range c.Commands() {
			if sub.Hidden || sub.Name() == "help" || sub.Name() == "completion" {
				continue
			}
			walk(sub)
		}
	}
	walk(root)
	return strings.TrimRight(b.String(), "\n") + "\n"
}

func TestCLIDocs(t *testing.T) {
	got := renderCLIDocs(buildCLI())
	if os.Getenv("UPDATE_CLI_DOCS") == "1" {
		if err := os.WriteFile(cliDocsPath, []byte(got), 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}
	want, err := os.ReadFile(cliDocsPath)
	if err != nil || string(want) != got {
		t.Fatalf("%s is out of date with the CLI; run `UPDATE_CLI_DOCS=1 go test ./cmd/daemon -run TestCLIDocs` from daemon/ (read err: %v)", cliDocsPath, err)
	}
}
