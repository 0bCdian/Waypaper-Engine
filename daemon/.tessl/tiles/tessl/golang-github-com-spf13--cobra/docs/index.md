# Cobra

Cobra is a comprehensive Go library for building modern command-line interface (CLI) applications. It provides a structured framework for creating subcommand-based applications with POSIX-compliant flag parsing, intelligent command suggestions, automatic help generation, and shell completions for bash, zsh, fish, and PowerShell.

## Package Information

- **Package Name**: cobra
- **Package Type**: golang
- **Language**: Go
- **Installation**: `go get -u github.com/spf13/cobra@latest`
- **Import Path**: `github.com/spf13/cobra`

## Core Imports

```go { .api }
import "github.com/spf13/cobra"
```

For documentation generation:

```go { .api }
import "github.com/spf13/cobra/doc"
```

## Basic Usage

```go
package main

import (
    "fmt"
    "github.com/spf13/cobra"
)

func main() {
    var verbose bool

    rootCmd := &cobra.Command{
        Use:   "myapp",
        Short: "My application does amazing things",
        Long:  "A longer description of what my application does",
        Run: func(cmd *cobra.Command, args []string) {
            fmt.Println("Hello from myapp!")
            if verbose {
                fmt.Println("Verbose mode enabled")
            }
        },
    }

    rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "verbose output")

    if err := rootCmd.Execute(); err != nil {
        fmt.Println(err)
        os.Exit(1)
    }
}
```

## Architecture

Cobra applications are built around a tree of Commands. Each Command represents an action (like `git clone` or `kubectl get`). Commands can have:

- **Subcommands**: Child commands that extend functionality
- **Flags**: Options that modify behavior (local or persistent)
- **Arguments**: Positional parameters validated by Args functions
- **Run Hooks**: Lifecycle functions (PreRun, Run, PostRun) that execute in sequence

The library follows the pattern `APPNAME VERB NOUN --ADJECTIVE` (e.g., `git clone URL --bare`).

## Capabilities

### Command Creation and Management

Create and configure Command structs to define CLI structure, add subcommands, and control command hierarchy.

```go { .api }
type Command struct {
    Use                   string
    Aliases               []string
    SuggestFor            []string
    Short                 string
    Long                  string
    Example               string
    ValidArgs             []Completion
    ValidArgsFunction     CompletionFunc
    Args                  PositionalArgs
    ArgAliases            []string
    BashCompletionFunction string
    Deprecated            string
    Annotations           map[string]string
    Version               string
    GroupID               string

    PersistentPreRun      func(cmd *Command, args []string)
    PersistentPreRunE     func(cmd *Command, args []string) error
    PreRun                func(cmd *Command, args []string)
    PreRunE               func(cmd *Command, args []string) error
    Run                   func(cmd *Command, args []string)
    RunE                  func(cmd *Command, args []string) error
    PostRun               func(cmd *Command, args []string)
    PostRunE              func(cmd *Command, args []string) error
    PersistentPostRun     func(cmd *Command, args []string)
    PersistentPostRunE    func(cmd *Command, args []string) error

    FParseErrWhitelist    FParseErrWhitelist
    CompletionOptions     CompletionOptions
    TraverseChildren      bool
    Hidden                bool
    SilenceErrors         bool
    SilenceUsage          bool
    DisableFlagParsing    bool
    DisableAutoGenTag     bool
    DisableFlagsInUseLine bool
    DisableSuggestions    bool
    SuggestionsMinimumDistance int
}

func (c *Command) AddCommand(cmds ...*Command)
func (c *Command) Execute() error
func (c *Command) ExecuteC() (cmd *Command, err error)
func (c *Command) ExecuteContext(ctx context.Context) error
func (c *Command) ExecuteContextC(ctx context.Context) (*Command, error)
```

[Command Basics](./command-basics.md)

### Flag Management and Validation

Define, configure, and validate command-line flags including required flags, flag groups, and completion behavior.

```go { .api }
func (c *Command) Flags() *pflag.FlagSet
func (c *Command) PersistentFlags() *pflag.FlagSet
func (c *Command) LocalFlags() *pflag.FlagSet
func (c *Command) InheritedFlags() *pflag.FlagSet

func (c *Command) MarkFlagRequired(name string) error
func (c *Command) MarkFlagsRequiredTogether(flagNames ...string)
func (c *Command) MarkFlagsOneRequired(flagNames ...string)
func (c *Command) MarkFlagsMutuallyExclusive(flagNames ...string)
func (c *Command) ValidateRequiredFlags() error
func (c *Command) ValidateFlagGroups() error
```

[Flag Management](./flags.md)

### Argument Validation

Validate positional arguments with built-in validators or custom validation functions.

```go { .api }
type PositionalArgs func(cmd *Command, args []string) error

func NoArgs(cmd *Command, args []string) error
func ArbitraryArgs(cmd *Command, args []string) error
func OnlyValidArgs(cmd *Command, args []string) error
func MinimumNArgs(n int) PositionalArgs
func MaximumNArgs(n int) PositionalArgs
func ExactArgs(n int) PositionalArgs
func RangeArgs(min int, max int) PositionalArgs
func MatchAll(pargs ...PositionalArgs) PositionalArgs
func ExactValidArgs(n int) PositionalArgs
```

[Command Basics - Argument Validation](./command-basics.md#argument-validation)

### Shell Completions

Generate and customize shell completion scripts for bash, zsh, fish, and PowerShell.

```go { .api }
type Completion = string
type CompletionFunc = func(cmd *Command, args []string, toComplete string) ([]Completion, ShellCompDirective)
type ShellCompDirective int

const (
    ShellCompDirectiveDefault ShellCompDirective = 0
    ShellCompDirectiveError
    ShellCompDirectiveNoSpace
    ShellCompDirectiveNoFileComp
    ShellCompDirectiveFilterFileExt
    ShellCompDirectiveFilterDirs
    ShellCompDirectiveKeepOrder
)

func CompletionWithDesc(choice string, description string) Completion
func NoFileCompletions(cmd *Command, args []string, toComplete string) ([]Completion, ShellCompDirective)
func FixedCompletions(choices []Completion, directive ShellCompDirective) CompletionFunc
func AppendActiveHelp(compArray []Completion, activeHelpStr string) []Completion
func GetActiveHelpConfig(cmd *Command) string

func (c *Command) GenBashCompletion(w io.Writer) error
func (c *Command) GenBashCompletionV2(w io.Writer, includeDesc bool) error
func (c *Command) GenZshCompletion(w io.Writer) error
func (c *Command) GenFishCompletion(w io.Writer, includeDesc bool) error
func (c *Command) GenPowerShellCompletion(w io.Writer) error
func (c *Command) RegisterFlagCompletionFunc(flagName string, f CompletionFunc) error
```

[Shell Completions](./completions.md)

### Documentation Generation

Generate documentation in multiple formats: man pages, markdown, reStructuredText, and YAML.

```go { .api }
func GenMan(cmd *cobra.Command, header *GenManHeader, w io.Writer) error
func GenMarkdown(cmd *cobra.Command, w io.Writer) error
func GenReST(cmd *cobra.Command, w io.Writer) error
func GenYaml(cmd *cobra.Command, w io.Writer) error
```

[Documentation Generation](./doc-generation.md)

### Help and Usage

Customize help output, usage messages, and error handling.

```go { .api }
func (c *Command) Help() error
func (c *Command) Usage() error
func (c *Command) SetHelpFunc(f func(*Command, []string))
func (c *Command) SetUsageFunc(f func(*Command) error)
func (c *Command) SetHelpTemplate(s string)
func (c *Command) SetUsageTemplate(s string)
func (c *Command) HelpFunc() func(*Command, []string)
func (c *Command) UsageFunc() func(*Command) error
```

[Command Basics - Help and Usage](./command-basics.md#help-and-usage)

### Command Groups

Organize subcommands into groups for better help output organization.

```go { .api }
type Group struct {
    ID    string
    Title string
}

func (c *Command) AddGroup(groups ...*Group)
func (c *Command) Groups() []*Group
func (c *Command) ContainsGroup(groupID string) bool
```

[Command Basics - Command Groups](./command-basics.md#command-groups)

### Global Configuration

Configure global Cobra behavior for prefix matching, command sorting, case sensitivity, and hook traversal.

```go { .api }
var EnablePrefixMatching bool
var EnableCommandSorting bool
var EnableCaseInsensitive bool
var EnableTraverseRunHooks bool
var MousetrapHelpText string
var MousetrapDisplayDuration time.Duration

func OnInitialize(y ...func())
func OnFinalize(y ...func())
func AddTemplateFunc(name string, tmplFunc interface{})
func AddTemplateFuncs(tmplFuncs template.FuncMap)
```

[Command Basics - Global Configuration](./command-basics.md#global-configuration)

## Common Types

```go { .api }
type FParseErrWhitelist = pflag.ParseErrorsAllowlist

type CompletionOptions struct {
    DisableDefaultCmd         bool
    DisableNoDescFlag         bool
    DisableDescriptions       bool
    HiddenDefaultCmd          bool
    DefaultShellCompDirective *ShellCompDirective
}

func (receiver *CompletionOptions) SetDefaultShellCompDirective(directive ShellCompDirective)
```

## Error Messages and Output

```go { .api }
func CheckErr(msg interface{})
func WriteStringAndCheck(b io.StringWriter, s string)
func CompDebug(msg string, printToStdErr bool)
func CompDebugln(msg string, printToStdErr bool)
func CompError(msg string)
func CompErrorln(msg string)

func (c *Command) SetIn(r io.Reader)
func (c *Command) SetOut(w io.Writer)
func (c *Command) SetErr(w io.Writer)
func (c *Command) InOrStdin() io.Reader
func (c *Command) OutOrStdout() io.Writer
func (c *Command) ErrOrStderr() io.Writer
func (c *Command) Print(i ...interface{})
func (c *Command) Println(i ...interface{})
func (c *Command) Printf(format string, i ...interface{})
func (c *Command) PrintErr(i ...interface{})
func (c *Command) PrintErrln(i ...interface{})
func (c *Command) PrintErrf(format string, i ...interface{})
```

## Constants

```go { .api }
const (
    BashCompFilenameExt     = "cobra_annotation_bash_completion_filename_extensions"
    BashCompCustom          = "cobra_annotation_bash_completion_custom"
    BashCompOneRequiredFlag = "cobra_annotation_bash_completion_one_required_flag"
    BashCompSubdirsInDir    = "cobra_annotation_bash_completion_subdirs_in_dir"
)

const (
    FlagSetByCobraAnnotation     = "cobra_annotation_flag_set_by_cobra"
    CommandDisplayNameAnnotation = "cobra_annotation_command_display_name"
)

const (
    ShellCompRequestCmd       = "__complete"
    ShellCompNoDescRequestCmd = "__completeNoDesc"
)
```
