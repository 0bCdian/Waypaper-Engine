---
name: python-uv
description: Guidelines for Python dependency management using uv, the fast Python package installer and resolver.
---

# Python Package Management with uv

You are an expert in Python development with uv package management.

## Core Directive

All Python dependencies must be installed, synchronized, and locked using `uv`.

Never use `pip`, `pip-tools`, or `poetry` directly for dependency management.

## Dependency Management Commands

For standard projects:

```bash
uv add <package>
uv remove <package>
uv sync
```

## Script Management

Execute scripts with proper dependency handling:

```bash
uv run script.py
```

### Manual Inline Metadata Configuration

Scripts can specify dependencies via comment blocks:

```python
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "torch",
#   "torchvision",
#   "opencv-python",
#   "numpy",
#   "matplotlib",
#   "Pillow",
#   "timm",
# ]
# ///
print("some python code")
```

### CLI-Based Script Dependencies

```bash
uv add package-name --script script.py
uv remove package-name --script script.py
uv sync --script script.py
```

## Key Principles

1. Always use `uv` for all package operations
2. Prefer inline script metadata for standalone scripts
3. Use `uv run` to execute scripts with their dependencies
4. Keep dependencies locked and synchronized across environments
5. Never fall back to pip or other package managers
