# Flag Management

This document covers flag management in Cobra, including flag types, validation, grouping, and completion configuration. Cobra uses the github.com/spf13/pflag library for POSIX-compliant flag parsing.

## Flag Access

```go { .api }
func (c *Command) Flags() *pflag.FlagSet
func (c *Command) PersistentFlags() *pflag.FlagSet
func (c *Command) LocalFlags() *pflag.FlagSet
func (c *Command) InheritedFlags() *pflag.FlagSet
func (c *Command) LocalNonPersistentFlags() *pflag.FlagSet
func (c *Command) NonInheritedFlags() *pflag.FlagSet
func (c *Command) Flag(name string) *pflag.Flag
```

Access different flag sets:

```go
// Complete flag set (local + persistent + inherited)
allFlags := cmd.Flags()
allFlags.StringP("output", "o", "", "Output file")

// Persistent flags (inherited by children)
persistentFlags := cmd.PersistentFlags()
persistentFlags.BoolP("verbose", "v", false, "Verbose output")

// Local flags (specific to this command)
localFlags := cmd.LocalFlags()

// Inherited flags (from parents)
inheritedFlags := cmd.InheritedFlags()

// Lookup specific flag
flag := cmd.Flag("output")
```

- **Flags**: Complete FlagSet (local + persistent + inherited from parents)
- **PersistentFlags**: Persistent flags set on this command (inherited by children)
- **LocalFlags**: Flags specific to this command (not inherited)
- **InheritedFlags**: Flags inherited from parent commands
- **LocalNonPersistentFlags**: Local flags that are not persistent
- **NonInheritedFlags**: All flags not inherited from parents
- **Flag**: Lookup flag by name (climbs tree looking for match)

## Flag Parsing

```go { .api }
func (c *Command) ParseFlags(args []string) error
func (c *Command) ResetFlags()
```

- **ParseFlags**: Parse persistent and local flags from args
- **ResetFlags**: Reset all flags to default values

## Flag Inspection

```go { .api }
func (c *Command) HasFlags() bool
func (c *Command) HasAvailableFlags() bool
func (c *Command) HasLocalFlags() bool
func (c *Command) HasAvailableLocalFlags() bool
func (c *Command) HasPersistentFlags() bool
func (c *Command) HasAvailablePersistentFlags() bool
func (c *Command) HasInheritedFlags() bool
func (c *Command) HasAvailableInheritedFlags() bool
```

Check which flag types are present:

```go
if cmd.HasAvailableFlags() {
    // Command has visible flags
}

if cmd.HasPersistentFlags() {
    // Command defines persistent flags
}
```

- **HasFlags**: Check if command has any flags
- **HasAvailableFlags**: Check if has visible flags (not hidden/deprecated)
- **HasLocalFlags**: Check if has local flags
- **HasAvailableLocalFlags**: Check if has visible local flags
- **HasPersistentFlags**: Check if has persistent flags
- **HasAvailablePersistentFlags**: Check if has visible persistent flags
- **HasInheritedFlags**: Check if has inherited flags
- **HasAvailableInheritedFlags**: Check if has visible inherited flags

## Flag Definition

Define flags using the pflag.FlagSet methods. Common flag types:

```go
cmd := &cobra.Command{Use: "example"}

// String flags
cmd.Flags().String("name", "", "Name value")
cmd.Flags().StringP("output", "o", "default.txt", "Output file") // With shorthand

// Bool flags
cmd.Flags().Bool("verbose", false, "Verbose output")
cmd.Flags().BoolP("debug", "d", false, "Debug mode")

// Int flags
cmd.Flags().Int("count", 10, "Number of items")
cmd.Flags().IntP("port", "p", 8080, "Port number")

// StringSlice flags
cmd.Flags().StringSlice("tags", []string{}, "Tags to apply")

// Duration flags
cmd.Flags().Duration("timeout", 30*time.Second, "Operation timeout")

// Persistent flags (inherited by children)
cmd.PersistentFlags().String("config", "", "Config file path")
```

Bind flags to variables:

```go
var verbose bool
var output string
var port int

cmd.Flags().BoolVarP(&verbose, "verbose", "v", false, "Verbose output")
cmd.Flags().StringVarP(&output, "output", "o", "", "Output file")
cmd.Flags().IntVarP(&port, "port", "p", 8080, "Port number")

// Access directly in Run
cmd.Run = func(cmd *cobra.Command, args []string) {
    if verbose {
        fmt.Println("Verbose mode enabled")
    }
    fmt.Printf("Output file: %s\n", output)
    fmt.Printf("Port: %d\n", port)
}
```

Or access flags in Run function:

```go
cmd.Run = func(cmd *cobra.Command, args []string) {
    name, _ := cmd.Flags().GetString("name")
    verbose, _ := cmd.Flags().GetBool("verbose")
    port, _ := cmd.Flags().GetInt("port")
}
```

## Flag Validation - Required Flags

```go { .api }
func (c *Command) MarkFlagRequired(name string) error
func (c *Command) MarkPersistentFlagRequired(name string) error
func (c *Command) ValidateRequiredFlags() error
func MarkFlagRequired(flags *pflag.FlagSet, name string) error
```

Mark flags as required:

```go
cmd := &cobra.Command{Use: "process"}
cmd.Flags().String("input", "", "Input file")
cmd.Flags().String("output", "", "Output file")

cmd.MarkFlagRequired("input")
cmd.MarkFlagRequired("output")

// Or use package-level function
cobra.MarkFlagRequired(cmd.Flags(), "input")
```

- **MarkFlagRequired**: Mark local flag as required
- **MarkPersistentFlagRequired**: Mark persistent flag as required
- **ValidateRequiredFlags**: Validate all required flags are present
- **MarkFlagRequired (package)**: Mark flag in FlagSet as required

## Flag Groups

```go { .api }
func (c *Command) MarkFlagsRequiredTogether(flagNames ...string)
func (c *Command) MarkFlagsOneRequired(flagNames ...string)
func (c *Command) MarkFlagsMutuallyExclusive(flagNames ...string)
func (c *Command) ValidateFlagGroups() error
```

Define relationships between flags:

```go
cmd := &cobra.Command{Use: "deploy"}
cmd.Flags().String("username", "", "Username")
cmd.Flags().String("password", "", "Password")
cmd.Flags().String("token", "", "Access token")
cmd.Flags().String("region", "", "AWS region")
cmd.Flags().String("zone", "", "GCP zone")

// All or none: username and password must be used together
cmd.MarkFlagsRequiredTogether("username", "password")

// At least one required: must provide either token or username+password
cmd.MarkFlagsOneRequired("token", "username")

// Mutually exclusive: cannot use both region and zone
cmd.MarkFlagsMutuallyExclusive("region", "zone")
```

- **MarkFlagsRequiredTogether**: All flags in group must be set together or none at all
- **MarkFlagsOneRequired**: At least one flag from group must be set
- **MarkFlagsMutuallyExclusive**: At most one flag from group can be set
- **ValidateFlagGroups**: Validate all flag group constraints

## Flag Completion

```go { .api }
func (c *Command) MarkFlagFilename(name string, extensions ...string) error
func (c *Command) MarkPersistentFlagFilename(name string, extensions ...string) error
func (c *Command) MarkFlagDirname(name string) error
func (c *Command) MarkPersistentFlagDirname(name string) error
func (c *Command) MarkFlagCustom(name string, f string) error
func (c *Command) RegisterFlagCompletionFunc(flagName string, f CompletionFunc) error
func (c *Command) GetFlagCompletionFunc(flagName string) (CompletionFunc, bool)

func MarkFlagFilename(flags *pflag.FlagSet, name string, extensions ...string) error
func MarkFlagDirname(flags *pflag.FlagSet, name string) error
func MarkFlagCustom(flags *pflag.FlagSet, name string, f string) error
```

Configure flag completion behavior:

```go
cmd := &cobra.Command{Use: "process"}
cmd.Flags().String("input", "", "Input file")
cmd.Flags().String("config", "", "Config file")
cmd.Flags().String("dir", "", "Working directory")
cmd.Flags().String("format", "", "Output format")

// File completion with extension filters
cmd.MarkFlagFilename("input", "txt", "csv", "json")
cmd.MarkFlagFilename("config", "yaml", "yml")

// Directory completion
cmd.MarkFlagDirname("dir")

// Custom completion function
cmd.RegisterFlagCompletionFunc("format", func(cmd *cobra.Command, args []string, toComplete string) ([]cobra.Completion, cobra.ShellCompDirective) {
    return []cobra.Completion{"json", "yaml", "xml"}, cobra.ShellCompDirectiveDefault
})

// Legacy bash-only custom completion
cmd.MarkFlagCustom("format", "__cobra_custom_func")
```

- **MarkFlagFilename**: Enable file completion with optional extension filters
- **MarkPersistentFlagFilename**: Enable file completion for persistent flag
- **MarkFlagDirname**: Enable directory completion
- **MarkPersistentFlagDirname**: Enable directory completion for persistent flag
- **MarkFlagCustom**: Add custom bash completion (legacy, use RegisterFlagCompletionFunc)
- **RegisterFlagCompletionFunc**: Register completion function for flag (works across all shells)
- **GetFlagCompletionFunc**: Get registered completion function for flag
- **Package-level functions**: Apply completion to flags in a FlagSet

## Flag Annotations

Flags support annotations for metadata and completion behavior. Common annotation constants:

```go { .api }
const (
    BashCompFilenameExt     = "cobra_annotation_bash_completion_filename_extensions"
    BashCompCustom          = "cobra_annotation_bash_completion_custom"
    BashCompOneRequiredFlag = "cobra_annotation_bash_completion_one_required_flag"
    BashCompSubdirsInDir    = "cobra_annotation_bash_completion_subdirs_in_dir"
)

const (
    FlagSetByCobraAnnotation = "cobra_annotation_flag_set_by_cobra"
)
```

Annotations are typically set internally by marking functions, but can be accessed:

```go
flag := cmd.Flags().Lookup("output")
if flag != nil {
    annotations := flag.Annotations
    // Check annotations
}
```

## Deprecated Completion Methods

```go { .api }
func (c *Command) MarkZshCompPositionalArgumentFile(argPosition int, patterns ...string) error
func (c *Command) MarkZshCompPositionalArgumentWords(argPosition int, words ...string) error
```

These methods are deprecated and disabled:

- **MarkZshCompPositionalArgumentFile**: Deprecated, use ValidArgsFunction with ShellCompDirectiveFilterFileExt
- **MarkZshCompPositionalArgumentWords**: Deprecated, use ValidArgs or ValidArgsFunction

## Flag Completion Types

```go { .api }
type CompletionFunc = func(cmd *Command, args []string, toComplete string) ([]Completion, ShellCompDirective)
```

CompletionFunc provides dynamic completions for flags. See the [Shell Completions](./completions.md) document for details on completion types and directives.

## Example: Complete Flag Configuration

```go
package main

import (
    "fmt"
    "github.com/spf13/cobra"
    "os"
)

func main() {
    var (
        input   string
        output  string
        format  string
        verbose bool
        count   int
    )

    rootCmd := &cobra.Command{
        Use:   "process",
        Short: "Process data files",
        RunE: func(cmd *cobra.Command, args []string) error {
            fmt.Printf("Processing %s -> %s (format: %s)\n", input, output, format)
            return nil
        },
    }

    // Define flags
    rootCmd.Flags().StringVarP(&input, "input", "i", "", "Input file (required)")
    rootCmd.Flags().StringVarP(&output, "output", "o", "", "Output file (required)")
    rootCmd.Flags().StringVarP(&format, "format", "f", "json", "Output format")
    rootCmd.Flags().BoolVarP(&verbose, "verbose", "v", false, "Verbose output")
    rootCmd.Flags().IntVarP(&count, "count", "c", 10, "Number of items")

    // Mark required flags
    rootCmd.MarkFlagRequired("input")
    rootCmd.MarkFlagRequired("output")

    // Configure completions
    rootCmd.MarkFlagFilename("input", "txt", "csv", "json")
    rootCmd.MarkFlagFilename("output")

    rootCmd.RegisterFlagCompletionFunc("format", func(cmd *cobra.Command, args []string, toComplete string) ([]cobra.Completion, cobra.ShellCompDirective) {
        formats := []cobra.Completion{"json", "yaml", "xml", "csv"}
        return formats, cobra.ShellCompDirectiveDefault
    })

    if err := rootCmd.Execute(); err != nil {
        os.Exit(1)
    }
}
```

## Hidden Flags

Hide flags from help output using pflag:

```go
cmd := &cobra.Command{Use: "example"}
cmd.Flags().String("secret", "", "Secret value")
cmd.Flags().Lookup("secret").Hidden = true
```

## Flag Shortcuts

Access flag values using pflag.FlagSet methods:

```go
// In Run function
value, err := cmd.Flags().GetString("name")
count, err := cmd.Flags().GetInt("count")
enabled, err := cmd.Flags().GetBool("enabled")
tags, err := cmd.Flags().GetStringSlice("tags")
duration, err := cmd.Flags().GetDuration("timeout")
```

Check if flag was set:

```go
if cmd.Flags().Changed("verbose") {
    // Flag was explicitly set by user
}
```

## Persistent vs Local Flags

**Persistent Flags**: Defined on a command and inherited by all children

```go
rootCmd := &cobra.Command{Use: "app"}
rootCmd.PersistentFlags().BoolP("verbose", "v", false, "Verbose output")

subCmd := &cobra.Command{Use: "sub"}
rootCmd.AddCommand(subCmd)

// subCmd inherits the --verbose flag from rootCmd
```

**Local Flags**: Only available on the command where defined

```go
rootCmd := &cobra.Command{Use: "app"}
subCmd := &cobra.Command{Use: "sub"}
subCmd.Flags().String("local", "", "Local to sub only")
rootCmd.AddCommand(subCmd)

// --local flag only available when running "app sub", not "app"
```

## Flag Merge

```go { .api }
func (c *Command) mergePersistentFlags()
```

Internal method to merge persistent flags from parents. Called automatically during flag setup.
