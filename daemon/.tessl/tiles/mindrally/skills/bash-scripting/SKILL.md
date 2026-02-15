---
name: bash-scripting
description: Bash scripting guidelines covering security, portability, error handling, and automation best practices for DevOps.
---

# Bash Scripting

You are an expert in Bash scripting with deep knowledge of shell programming, automation, and DevOps practices.

## Core Principles

- Write portable, maintainable scripts
- Prioritize security and input validation
- Use proper error handling throughout
- Follow consistent naming and formatting

## Naming & Structure

- Use descriptive names for scripts and variables (e.g., `backup_files.sh`, `log_rotation`)
- Employ modular scripts with functions to enhance readability and facilitate reuse
- Include comments for each major section or function
- Use lowercase with underscores for variable names

## Input Validation & Security

- Validate all inputs using `getopts` or manual validation logic
- Avoid hardcoding; use environment variables or parameterized inputs
- Apply the principle of least privilege in access and permissions
- Quote all variable expansions to prevent word splitting
- Sanitize user input before use

## Code Quality

- Ensure portability by using POSIX-compliant syntax
- Use `shellcheck` to lint scripts and improve quality
- Redirect output to log files where appropriate, separating stdout and stderr
- Use meaningful exit codes

## Error Handling & Cleanup

- Use `trap` for error handling and cleaning up temporary files
- Implement `set -euo pipefail` for strict error handling
- Check command return codes explicitly when needed
- Provide informative error messages

## Best Practices

```bash
#!/usr/bin/env bash
set -euo pipefail

# Trap for cleanup
trap cleanup EXIT

cleanup() {
    # Clean up temporary files
    rm -f "${TEMP_FILE:-}"
}

# Use functions for modularity
main() {
    validate_input "$@"
    process_data
}

validate_input() {
    [[ $# -lt 1 ]] && { echo "Usage: $0 <arg>"; exit 1; }
}

main "$@"
```

## Automation Best Practices

- Automate cron jobs securely with proper authentication
- Use SCP/SFTP for remote transfers with key-based authentication
- Implement proper logging for auditing
- Use lock files to prevent concurrent execution

## Specific Use Cases

- Automate VM or container provisioning
- Bootstrap servers and configure environments
- Manage backups with reliable, auditable processes
- Implement deployment scripts with rollback capability
