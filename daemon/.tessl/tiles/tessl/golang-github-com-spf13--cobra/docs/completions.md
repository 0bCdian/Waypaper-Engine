# Shell Completions

This document covers Cobra's shell completion functionality, including completion generation, customization, and the completion API for bash, zsh, fish, and PowerShell.

## Completion Generation

```go { .api }
func (c *Command) GenBashCompletion(w io.Writer) error
func (c *Command) GenBashCompletionFile(filename string) error
func (c *Command) GenBashCompletionV2(w io.Writer, includeDesc bool) error
func (c *Command) GenBashCompletionFileV2(filename string, includeDesc bool) error

func (c *Command) GenZshCompletion(w io.Writer) error
func (c *Command) GenZshCompletionFile(filename string) error
func (c *Command) GenZshCompletionNoDesc(w io.Writer) error
func (c *Command) GenZshCompletionFileNoDesc(filename string) error

func (c *Command) GenFishCompletion(w io.Writer, includeDesc bool) error
func (c *Command) GenFishCompletionFile(filename string, includeDesc bool) error

func (c *Command) GenPowerShellCompletion(w io.Writer) error
func (c *Command) GenPowerShellCompletionFile(filename string) error
func (c *Command) GenPowerShellCompletionWithDesc(w io.Writer) error
func (c *Command) GenPowerShellCompletionFileWithDesc(filename string) error
```

Generate completion scripts:

```go
package main

import (
    "github.com/spf13/cobra"
    "os"
)

func main() {
    rootCmd := &cobra.Command{Use: "myapp"}

    // Add subcommands...

    // Generate bash completion to stdout
    rootCmd.GenBashCompletion(os.Stdout)

    // Generate to file
    rootCmd.GenBashCompletionFile("/usr/local/etc/bash_completion.d/myapp")

    // Bash v2 with descriptions
    rootCmd.GenBashCompletionFileV2("/usr/local/etc/bash_completion.d/myapp", true)

    // Zsh with descriptions
    rootCmd.GenZshCompletionFile("/usr/local/share/zsh/site-functions/_myapp")

    // Fish with descriptions
    rootCmd.GenFishCompletionFile("~/.config/fish/completions/myapp.fish", true)

    // PowerShell with descriptions
    rootCmd.GenPowerShellCompletionFileWithDesc("myapp.ps1")
}
```

- **GenBashCompletion**: Generate legacy bash completion script
- **GenBashCompletionFile**: Generate legacy bash completion to file
- **GenBashCompletionV2**: Generate bash completion v2 (better support)
- **GenBashCompletionFileV2**: Generate bash completion v2 to file
- **GenZshCompletion**: Generate zsh completion with descriptions
- **GenZshCompletionFile**: Generate zsh completion to file
- **GenZshCompletionNoDesc**: Generate zsh completion without descriptions
- **GenZshCompletionFileNoDesc**: Generate zsh completion without descriptions to file
- **GenFishCompletion**: Generate fish completion
- **GenFishCompletionFile**: Generate fish completion to file
- **GenPowerShellCompletion**: Generate PowerShell completion without descriptions
- **GenPowerShellCompletionFile**: Generate PowerShell completion to file
- **GenPowerShellCompletionWithDesc**: Generate PowerShell completion with descriptions
- **GenPowerShellCompletionFileWithDesc**: Generate PowerShell completion with descriptions to file

## Completion Types

```go { .api }
type Completion = string
```

A Completion is a string that can be used for completions. Two formats are supported:

1. The completion choice alone: `"option1"`
2. The completion choice with description (TAB-separated): `"option1\tThis is option 1"`

```go { .api }
func CompletionWithDesc(choice string, description string) Completion
```

Create a completion with description:

```go
completions := []cobra.Completion{
    cobra.CompletionWithDesc("json", "JSON format"),
    cobra.CompletionWithDesc("yaml", "YAML format"),
    cobra.CompletionWithDesc("xml", "XML format"),
}
```

## Completion Functions

```go { .api }
type CompletionFunc = func(cmd *Command, args []string, toComplete string) ([]Completion, ShellCompDirective)
```

CompletionFunc provides dynamic completion results. Parameters:

- **cmd**: The command being completed
- **args**: Arguments provided so far (parsed)
- **toComplete**: The partial word being completed

Returns:
- **[]Completion**: List of completion choices
- **ShellCompDirective**: Directive controlling shell behavior

```go
cmd := &cobra.Command{
    Use:   "get",
    Short: "Get resources",
    ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]cobra.Completion, cobra.ShellCompDirective) {
        if len(args) == 0 {
            // First argument: resource type
            return []cobra.Completion{
                cobra.CompletionWithDesc("pod", "Kubernetes pod"),
                cobra.CompletionWithDesc("service", "Kubernetes service"),
                cobra.CompletionWithDesc("deployment", "Kubernetes deployment"),
            }, cobra.ShellCompDirectiveDefault
        }

        if len(args) == 1 {
            // Second argument: resource name
            // Query cluster for resource names based on args[0]
            names := getResourceNames(args[0])
            return names, cobra.ShellCompDirectiveNoFileComp
        }

        return nil, cobra.ShellCompDirectiveNoFileComp
    },
}
```

### NoFileCompletions

```go { .api }
func NoFileCompletions(cmd *Command, args []string, toComplete string) ([]Completion, ShellCompDirective)
```

Disables file completion for commands that should not trigger file completions:

```go
cmd := &cobra.Command{
    Use:               "status",
    ValidArgsFunction: cobra.NoFileCompletions,
}
```

### FixedCompletions

```go { .api }
func FixedCompletions(choices []Completion, directive ShellCompDirective) CompletionFunc
```

Creates a completion function that always returns the same results:

```go
fixedOptions := []cobra.Completion{"option1", "option2", "option3"}
cmd := &cobra.Command{
    Use:               "select",
    ValidArgsFunction: cobra.FixedCompletions(fixedOptions, cobra.ShellCompDirectiveDefault),
}

// Or for flags
cmd.RegisterFlagCompletionFunc("format",
    cobra.FixedCompletions(
        []cobra.Completion{"json", "yaml", "xml"},
        cobra.ShellCompDirectiveDefault,
    ),
)
```

## Shell Completion Directives

```go { .api }
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
```

Directives control shell behavior after providing completions:

- **ShellCompDirectiveDefault**: Default shell behavior (file completion if no completions provided)
- **ShellCompDirectiveError**: Error occurred, ignore completions
- **ShellCompDirectiveNoSpace**: Don't add space after completion (even with single completion)
- **ShellCompDirectiveNoFileComp**: Don't provide file completion when no completions
- **ShellCompDirectiveFilterFileExt**: Use completions as file extension filters
- **ShellCompDirectiveFilterDirs**: Only provide directory names in file completion
- **ShellCompDirectiveKeepOrder**: Preserve completion order (don't sort)

Directives are bit flags and can be combined:

```go
return completions, cobra.ShellCompDirectiveNoSpace | cobra.ShellCompDirectiveNoFileComp
```

### Directive Examples

**No file completion**:
```go
return []cobra.Completion{"option1", "option2"}, cobra.ShellCompDirectiveNoFileComp
```

**Filter files by extension**:
```go
return []cobra.Completion{".txt", ".log", ".md"}, cobra.ShellCompDirectiveFilterFileExt
```

**Only directories**:
```go
return []cobra.Completion{}, cobra.ShellCompDirectiveFilterDirs
```

**Keep order, no space**:
```go
return orderedOptions, cobra.ShellCompDirectiveKeepOrder | cobra.ShellCompDirectiveNoSpace
```

## Static Completions

```go
cmd := &cobra.Command{
    Use: "format",
    ValidArgs: []cobra.Completion{
        cobra.CompletionWithDesc("json", "JSON format"),
        cobra.CompletionWithDesc("yaml", "YAML format"),
        cobra.CompletionWithDesc("xml", "XML format"),
    },
}
```

Or without descriptions:

```go
cmd := &cobra.Command{
    Use:       "format",
    ValidArgs: []cobra.Completion{"json", "yaml", "xml"},
}
```

## Completion Options

```go { .api }
type CompletionOptions struct {
    DisableDefaultCmd         bool
    DisableNoDescFlag         bool
    DisableDescriptions       bool
    HiddenDefaultCmd          bool
    DefaultShellCompDirective *ShellCompDirective
}

func (receiver *CompletionOptions) SetDefaultShellCompDirective(directive ShellCompDirective)

type SliceValue interface {
    GetSlice() []string
}
```

Configure completion behavior:

```go
rootCmd := &cobra.Command{
    Use: "myapp",
    CompletionOptions: cobra.CompletionOptions{
        DisableDefaultCmd:   false, // Allow default "completion" command
        DisableNoDescFlag:   false, // Allow "--no-descriptions" flag
        DisableDescriptions: false, // Show descriptions
        HiddenDefaultCmd:    false, // Don't hide completion command
    },
}

// Or set default directive
rootCmd.CompletionOptions.SetDefaultShellCompDirective(cobra.ShellCompDirectiveNoFileComp)
```

- **DisableDefaultCmd**: Prevent Cobra from creating default 'completion' command
- **DisableNoDescFlag**: Prevent '--no-descriptions' flag for shells that support descriptions
- **DisableDescriptions**: Turn off all completion descriptions
- **HiddenDefaultCmd**: Make default 'completion' command hidden
- **DefaultShellCompDirective**: Default directive when none can be determined
- **SetDefaultShellCompDirective**: Helper to set default directive
- **SliceValue**: Interface for flags that hold slice values, used by completion system to access flag values

## Default Completion Command

```go { .api }
func (c *Command) InitDefaultCompletionCmd(args ...string)
```

Cobra automatically adds a default 'completion' command unless:
1. The feature has been explicitly disabled (CompletionOptions.DisableDefaultCmd)
2. Command has no subcommands
3. Command already has a 'completion' command

Initialize manually if needed:

```go
rootCmd.InitDefaultCompletionCmd()
```

## Active Help

```go { .api }
func GetActiveHelpConfig(cmd *Command) string
func AppendActiveHelp(compArray []Completion, activeHelpStr string) []Completion
```

ActiveHelp provides help messages during completion.

**GetActiveHelpConfig** gets the ActiveHelp environment variable value for the command. The environment variable is `<PROGRAM>_ACTIVE_HELP` where `<PROGRAM>` is the root command name in uppercase with non-alphanumeric characters replaced by underscores. Returns "0" if global `COBRA_ACTIVE_HELP` is set to "0".

```go
activeHelp := cobra.GetActiveHelpConfig(cmd)
if activeHelp != "0" {
    // Active help is enabled
}
```

**AppendActiveHelp** adds active help strings to the completion array. These strings are shown as help to the user during completion:

```go
func myCompletion(cmd *cobra.Command, args []string, toComplete string) ([]cobra.Completion, cobra.ShellCompDirective) {
    completions := []cobra.Completion{"option1", "option2", "option3"}

    // Add active help
    completions = cobra.AppendActiveHelp(completions, "Select an option from the list")
    completions = cobra.AppendActiveHelp(completions, "Use --verbose for detailed output")

    return completions, cobra.ShellCompDirectiveDefault
}
```

## Completion Debug Functions

```go { .api }
func CompDebug(msg string, printToStdErr bool)
func CompDebugln(msg string, printToStdErr bool)
func CompError(msg string)
func CompErrorln(msg string)
```

Debug and error functions for completion scripts:

```go
func customCompletion(cmd *cobra.Command, args []string, toComplete string) ([]cobra.Completion, cobra.ShellCompDirective) {
    cobra.CompDebugln("Starting custom completion", false)

    results, err := fetchCompletions()
    if err != nil {
        cobra.CompError(fmt.Sprintf("Failed to fetch: %v", err))
        return nil, cobra.ShellCompDirectiveError
    }

    return results, cobra.ShellCompDirectiveDefault
}
```

- **CompDebug**: Print debug message to completion log file
- **CompDebugln**: Print debug message with newline
- **CompError**: Print error message to stderr
- **CompErrorln**: Print error message with newline to stderr

Debug messages only appear when `BASH_COMP_DEBUG_FILE` environment variable is set to a log file path.

## Completion Constants

```go { .api }
const (
    ShellCompRequestCmd       = "__complete"
    ShellCompNoDescRequestCmd = "__completeNoDesc"
)
```

Hidden command names used by shell completion scripts:

- **ShellCompRequestCmd**: Command for requesting completions
- **ShellCompNoDescRequestCmd**: Command for requesting completions without descriptions

These are used internally by the completion system.

## Example: Dynamic Completions

```go
package main

import (
    "github.com/spf13/cobra"
    "strings"
)

func main() {
    rootCmd := &cobra.Command{Use: "kubectl"}

    getCmd := &cobra.Command{
        Use:   "get",
        Short: "Get resources",
        ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]cobra.Completion, cobra.ShellCompDirective) {
            if len(args) == 0 {
                // Complete resource types
                return []cobra.Completion{
                    cobra.CompletionWithDesc("pods", "Pod resources"),
                    cobra.CompletionWithDesc("services", "Service resources"),
                    cobra.CompletionWithDesc("deployments", "Deployment resources"),
                }, cobra.ShellCompDirectiveNoFileComp
            }

            if len(args) == 1 {
                // Complete resource names based on type
                resourceType := args[0]
                names := getResourceNames(resourceType) // Your function
                return names, cobra.ShellCompDirectiveNoFileComp
            }

            return nil, cobra.ShellCompDirectiveNoFileComp
        },
    }

    // Register flag completion
    getCmd.Flags().StringP("namespace", "n", "default", "Namespace")
    getCmd.RegisterFlagCompletionFunc("namespace", func(cmd *cobra.Command, args []string, toComplete string) ([]cobra.Completion, cobra.ShellCompDirective) {
        namespaces := getNamespaces() // Your function
        return namespaces, cobra.ShellCompDirectiveNoFileComp
    })

    rootCmd.AddCommand(getCmd)
    rootCmd.Execute()
}

func getResourceNames(resourceType string) []cobra.Completion {
    // Query your system for resource names
    return []cobra.Completion{"name1", "name2", "name3"}
}

func getNamespaces() []cobra.Completion {
    return []cobra.Completion{"default", "kube-system", "kube-public"}
}
```

## Flag Completion

See the [Flag Management](./flags.md#flag-completion) document for flag-specific completion functions:

- `RegisterFlagCompletionFunc`
- `GetFlagCompletionFunc`
- `MarkFlagFilename`
- `MarkFlagDirname`
- `MarkFlagCustom`

## Completion Best Practices

1. **Use ValidArgsFunction for dynamic completions**: Provides cross-shell support
2. **Return appropriate directives**: Use ShellCompDirectiveNoFileComp when no file completion is needed
3. **Provide descriptions**: Use CompletionWithDesc for better user experience
4. **Filter based on toComplete**: Match partial input for better completions
5. **Handle errors gracefully**: Return ShellCompDirectiveError on failures
6. **Test across shells**: Verify completions work in bash, zsh, fish, and PowerShell

## Completion Installation

After generating completion scripts, users typically install them:

**Bash**:
```bash
myapp completion bash > /usr/local/etc/bash_completion.d/myapp
```

**Zsh**:
```bash
myapp completion zsh > /usr/local/share/zsh/site-functions/_myapp
```

**Fish**:
```bash
myapp completion fish > ~/.config/fish/completions/myapp.fish
```

**PowerShell**:
```powershell
myapp completion powershell | Out-String | Invoke-Expression
```
