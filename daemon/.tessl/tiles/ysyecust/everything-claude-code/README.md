**Language:** English | [简体中文](README.zh-CN.md)

# Everything Claude Code

[![Stars](https://img.shields.io/github/stars/affaan-m/everything-claude-code?style=flat)](https://github.com/affaan-m/everything-claude-code/stargazers)
[![CI](https://img.shields.io/github/actions/workflow/status/ysyecust/everything-claude-code/ci.yml?label=CI)](https://github.com/ysyecust/everything-claude-code/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![C++](https://img.shields.io/badge/-C%2B%2B20-00599C?logo=c%2B%2B&logoColor=white)
![CMake](https://img.shields.io/badge/-CMake-064F8C?logo=cmake&logoColor=white)

**The complete collection of Claude Code configs for C++20 HPC development.**

Production-ready agents, skills, hooks, commands, rules, and configurations for high-performance computing with modern C++, CMake, Google Test, sanitizers, and more. Forked from [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) and adapted for C++20 HPC workflows.

---

## What's Inside

This repo is a **Claude Code plugin** - install it directly or copy components manually.

```
everything-claude-code/
|-- .claude-plugin/   # Plugin and marketplace manifests
|   |-- plugin.json         # Plugin metadata and component paths
|   |-- marketplace.json    # Marketplace catalog
|
|-- .github/workflows/ # CI/CD pipelines
|   |-- ci.yml              # Main CI (validate + test)
|   |-- reusable-validate.yml  # Reusable validation job
|   |-- reusable-test.yml      # Reusable test job
|
|-- agents/           # Specialized subagents for delegation
|   |-- planner.md               # Feature implementation planning
|   |-- architect.md             # System design decisions
|   |-- tdd-guide.md             # C++20 test-driven development
|   |-- code-reviewer.md         # Memory safety and performance review
|   |-- security-reviewer.md     # Sanitizer and vulnerability analysis
|   |-- build-error-resolver.md  # CMake/linker/template error resolution
|   |-- integration-test-runner.md  # CTest integration testing
|   |-- refactor-cleaner.md      # Dead code cleanup
|   |-- doc-updater.md           # Documentation sync
|   |-- database-reviewer.md     # SQL/database review
|   |-- go-reviewer.md           # Go code review
|   |-- go-build-resolver.md     # Go build error resolution
|
|-- skills/           # Workflow definitions and domain knowledge
|   |                             # --- C++20 HPC ---
|   |-- coding-standards/           # C++20 naming, concepts, ranges
|   |-- hpc-patterns/              # Cache-friendly, SIMD, threading, NUMA
|   |-- numerical-patterns/         # Sparse matrices, solvers, HPC I/O
|   |-- tdd-workflow/               # Google Test/Mock TDD methodology
|   |                             # --- Cross-language ---
|   |-- continuous-learning/        # Auto-extract patterns from sessions
|   |-- continuous-learning-v2/     # Instinct-based learning with confidence scoring
|   |-- iterative-retrieval/        # Progressive context refinement for subagents
|   |-- strategic-compact/          # Manual compaction suggestions
|   |-- security-review/            # Security checklist + cloud infrastructure
|   |-- eval-harness/               # Verification loop evaluation
|   |-- verification-loop/          # Continuous verification
|   |                             # --- Multi-language (from upstream) ---
|   |-- golang-patterns/           # Go idioms and best practices
|   |-- golang-testing/            # Go table-driven tests, benchmarks
|   |-- springboot-patterns/       # Spring Boot architecture
|   |-- springboot-tdd/            # Spring Boot TDD with JUnit 5
|   |-- springboot-security/       # Spring Security best practices
|   |-- java-coding-standards/     # Java coding conventions
|   |-- jpa-patterns/              # JPA/Hibernate patterns
|   |-- postgres-patterns/         # PostgreSQL optimization
|   |-- clickhouse-io/             # ClickHouse analytics patterns
|
|-- commands/         # Slash commands for quick execution
|   |-- tdd.md                # /tdd - C++20 test-driven development
|   |-- plan.md               # /plan - Implementation planning
|   |-- integration-test.md   # /integration-test - CTest integration tests
|   |-- code-review.md        # /code-review - Quality review
|   |-- build-fix.md          # /build-fix - Fix CMake build errors
|   |-- test-coverage.md      # /test-coverage - gcov/lcov coverage
|   |-- refactor-clean.md     # /refactor-clean - Dead code removal
|   |-- learn.md              # /learn - Extract patterns mid-session
|   |-- checkpoint.md         # /checkpoint - Save verification state
|   |-- verify.md             # /verify - Run verification loop
|   |-- setup-pm.md           # /setup-pm - Configure build system
|   |-- skill-create.md       # /skill-create - Generate skills from git history
|   |-- instinct-status.md    # /instinct-status - View learned instincts
|   |-- instinct-import.md    # /instinct-import - Import instincts
|   |-- instinct-export.md    # /instinct-export - Export instincts
|   |-- evolve.md             # /evolve - Cluster instincts into skills
|   |-- orchestrate.md        # /orchestrate - Multi-agent task orchestration
|   |-- eval.md               # /eval - Run evaluation harness
|
|-- rules/            # Always-follow guidelines
|   |-- security.md         # Buffer overflow, use-after-free, sanitizers
|   |-- coding-style.md     # RAII, const correctness, C++20 features
|   |-- testing.md          # Google Test, 80% coverage requirement
|   |-- git-workflow.md     # Commit format, PR process
|   |-- agents.md           # When to delegate to subagents
|   |-- performance.md      # Model selection, context management
|   |-- patterns.md         # Result type, CRTP, Builder pattern
|
|-- hooks/            # Trigger-based automations
|   |-- hooks.json                # clang-format, syntax check, debug detection
|   |-- memory-persistence/       # Session lifecycle hooks
|   |-- strategic-compact/        # Compaction suggestions
|
|-- schemas/          # JSON validation schemas
|   |-- hooks.schema.json         # hooks.json format validation
|   |-- plugin.schema.json        # plugin.json format validation
|
|-- scripts/          # Cross-platform Node.js scripts
|   |-- lib/                     # Shared utilities
|   |   |-- utils.js             # Cross-platform file/path/system utilities
|   |   |-- build-system.js      # CMake/Make detection and compiler selection
|   |-- hooks/                   # Hook implementations
|   |   |-- session-start.js     # Load context on session start
|   |   |-- session-end.js       # Save state on session end
|   |   |-- pre-compact.js       # Pre-compaction state saving
|   |   |-- suggest-compact.js   # Strategic compaction suggestions
|   |   |-- evaluate-session.js  # Extract patterns from sessions
|   |   |-- check-console-log.js # Detect C++ debug output (std::cout/printf)
|   |-- ci/                      # CI validation scripts
|   |   |-- validate-agents.js   # Validate agent frontmatter
|   |   |-- validate-commands.js # Validate command frontmatter
|   |   |-- validate-hooks.js    # Validate hooks.json format
|   |   |-- validate-rules.js    # Validate rules format
|   |   |-- validate-skills.js   # Validate skills format
|   |-- setup-build-system.js    # Interactive build system setup
|
|-- tests/            # Test suite
|   |-- lib/                     # Library tests
|   |-- hooks/                   # Hook tests
|   |-- integration/             # Integration tests
|   |-- run-all.js               # Run all tests
|
|-- contexts/         # Dynamic system prompt injection contexts
|   |-- dev.md              # Development mode context
|   |-- review.md           # Code review mode context
|   |-- research.md         # Research/exploration mode context
|
|-- the-shortform-guide.md  # Quick-start guide (C++20 HPC)
|-- the-longform-guide.md   # Comprehensive deep-dive guide (C++20 HPC)
```

---

## Build System Detection

The plugin automatically detects your preferred build system (CMake/Make) and compiler (GCC/Clang) with the following priority:

1. **Environment variable**: `CLAUDE_BUILD_SYSTEM` / `CLAUDE_CXX_COMPILER`
2. **Project config**: `.claude/build-system.json`
3. **Project files**: CMakeLists.txt or Makefile detection
4. **Global config**: `~/.claude/build-system.json`
5. **Fallback**: First available (cmake > make, clang > gcc)

To set your preferred build system:

```bash
# Via environment variable
export CLAUDE_BUILD_SYSTEM=cmake
export CLAUDE_CXX_COMPILER=clang++

# Via setup script
node scripts/setup-build-system.js --global cmake

# Detect current setting
node scripts/setup-build-system.js --detect

# List available options
node scripts/setup-build-system.js --list
```

---

## Ecosystem Tools

### Skill Creator

Two ways to generate Claude Code skills from your repository:

#### Option A: Local Analysis (Built-in)

Use the `/skill-create` command for local analysis without external services:

```bash
/skill-create                    # Analyze current repo
/skill-create --instincts        # Also generate instincts for continuous-learning
```

This analyzes your git history locally and generates SKILL.md files.

#### Option B: GitHub App (Advanced)

For advanced features (10k+ commits, auto-PRs, team sharing):

[Install GitHub App](https://github.com/apps/skill-creator) | [ecc.tools](https://ecc.tools)

```bash
# Comment on any issue:
/skill-creator analyze

# Or auto-triggers on push to default branch
```

Both options create:
- **SKILL.md files** - Ready-to-use skills for Claude Code
- **Instinct collections** - For continuous-learning-v2
- **Pattern extraction** - Learns from your commit history

### Continuous Learning v2

The instinct-based learning system automatically learns your patterns:

```bash
/instinct-status        # Show learned instincts with confidence
/instinct-import <file> # Import instincts from others
/instinct-export        # Export your instincts for sharing
/evolve                 # Cluster related instincts into skills
```

See `skills/continuous-learning-v2/` for full documentation.

---

## Requirements

### Claude Code CLI Version

**Minimum version: v2.1.0 or later**

This plugin requires Claude Code CLI v2.1.0+ due to changes in how the plugin system handles hooks.

Check your version:
```bash
claude --version
```

### Important: Hooks Auto-Loading Behavior

> **For Contributors:** Do NOT add a `"hooks"` field to `.claude-plugin/plugin.json`. This is enforced by a regression test.

Claude Code v2.1+ **automatically loads** `hooks/hooks.json` from any installed plugin by convention. Explicitly declaring it in `plugin.json` causes a duplicate detection error:

```
Duplicate hooks file detected: ./hooks/hooks.json resolves to already-loaded file
```

---

## Installation

### Option 1: Install as Plugin (Recommended)

```bash
# Add this repo as a marketplace
/plugin marketplace add affaan-m/everything-claude-code

# Install the plugin
/plugin install everything-claude-code@everything-claude-code
```

Or add directly to your `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "everything-claude-code": {
      "source": {
        "source": "github",
        "repo": "affaan-m/everything-claude-code"
      }
    }
  },
  "enabledPlugins": {
    "everything-claude-code@everything-claude-code": true
  }
}
```

This gives you instant access to all commands, agents, skills, and hooks.

> **Note:** The Claude Code plugin system does not support distributing `rules` via plugins ([upstream limitation](https://code.claude.com/docs/en/plugins-reference)). You need to install rules manually:
>
> ```bash
> # Clone the repo first
> git clone https://github.com/affaan-m/everything-claude-code.git
>
> # Option A: User-level rules (applies to all projects)
> cp -r everything-claude-code/rules/* ~/.claude/rules/
>
> # Option B: Project-level rules (applies to current project only)
> mkdir -p .claude/rules
> cp -r everything-claude-code/rules/* .claude/rules/
> ```

---

### Option 2: Manual Installation

```bash
# Clone the repo
git clone https://github.com/affaan-m/everything-claude-code.git

# Copy agents to your Claude config
cp everything-claude-code/agents/*.md ~/.claude/agents/

# Copy rules
cp everything-claude-code/rules/*.md ~/.claude/rules/

# Copy commands
cp everything-claude-code/commands/*.md ~/.claude/commands/

# Copy skills
cp -r everything-claude-code/skills/* ~/.claude/skills/
```

#### Add hooks to settings.json

Copy the hooks from `hooks/hooks.json` to your `~/.claude/settings.json`.

---

## Key Concepts

### Agents

Subagents handle delegated tasks with limited scope:

**C++20 HPC:**

- **tdd-guide** - C++20 TDD with Google Test/Mock
- **build-error-resolver** - CMake, linker, template errors
- **code-reviewer** - Memory safety, RAII, performance
- **security-reviewer** - ASan/UBSan/TSan/MSan analysis
- **integration-test-runner** - CTest labels, MPI tests

**General:**

- **planner** - Feature implementation planning
- **architect** - System design decisions
- **refactor-cleaner** - Dead code cleanup
- **doc-updater** - Documentation sync
- **database-reviewer** - SQL/database review
- **go-reviewer** / **go-build-resolver** - Go code review and build fixes

### Skills

**C++20 HPC domain knowledge:**

- **coding-standards** - Naming, concepts, ranges, constexpr
- **hpc-patterns** - Cache-friendly data, SIMD, threading, NUMA
- **numerical-patterns** - Sparse matrices, CG/GMRES, HPC I/O
- **tdd-workflow** - Google Test parameterized tests, CMake integration

**Cross-language (learning & workflow):**

- **continuous-learning-v2** - Instinct-based learning with confidence scoring
- **iterative-retrieval** - Progressive context refinement for subagents
- **strategic-compact** - Manual compaction suggestions
- **eval-harness** - Verification loop evaluation
- **security-review** - Security checklist + cloud infrastructure

**Multi-language (from upstream):**

- **golang-patterns** / **golang-testing** - Go idioms and testing
- **springboot-patterns** / **springboot-tdd** / **springboot-security** - Spring Boot
- **jpa-patterns** / **java-coding-standards** - Java/JPA
- **postgres-patterns** - PostgreSQL optimization
- **clickhouse-io** - ClickHouse analytics

### Hooks

Hooks fire on tool events:

```json
{
  "matcher": "tool == \"Edit\" && tool_input.file_path matches \"\\\\.(cpp|hpp|cc|h)$\"",
  "hooks": [{
    "type": "command",
    "command": "clang-format --style=Google -i \"$file_path\""
  }]
}
```

### Rules

Always-follow guidelines for C++20:

- **security.md** - Buffer overflow, use-after-free, CWE Top 25
- **coding-style.md** - RAII, const correctness, move semantics
- **testing.md** - Google Test, 80% coverage, TDD workflow
- **patterns.md** - Result type, CRTP, Builder pattern

---

## Guides

- **[Quick-start Guide](the-shortform-guide.md)** - Get productive fast with C++20 HPC patterns
- **[Comprehensive Guide](the-longform-guide.md)** - Deep dive into every component and workflow

---

## Running Tests

```bash
# Run all tests
node tests/run-all.js

# Run individual test files
node tests/lib/utils.test.js
node tests/lib/build-system.test.js
node tests/hooks/hooks.test.js

# Run CI validation scripts
node scripts/ci/validate-agents.js
node scripts/ci/validate-commands.js
node scripts/ci/validate-hooks.js
node scripts/ci/validate-rules.js
node scripts/ci/validate-skills.js
```

---

## C++20 Features Covered

- **Concepts** - Type constraints and requirements
- **Ranges** - Composable algorithms and views
- **std::span** - Non-owning contiguous views
- **std::expected** - Error handling without exceptions
- **constexpr/consteval** - Compile-time computation
- **Structured bindings** - Decomposition declarations
- **Three-way comparison** - Spaceship operator

---

## HPC Patterns

- Cache-friendly data structures (SoA/AoS)
- SIMD vectorization hints
- Thread pool and lock-free containers
- NUMA-aware memory allocation
- MPI communication patterns
- HDF5 and binary I/O

---

## Contributing

**Contributions are welcome and encouraged.**

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Ideas for Contributions

- Additional HPC patterns (GPU offload, heterogeneous computing)
- New solver algorithms (multigrid, domain decomposition)
- Build system integrations (Ninja, Meson)
- Profiling agents (perf, vtune, gprof)
- Additional sanitizer workflows

---

## Important Notes

### Context Window Management

**Critical:** Don't enable all MCPs at once. Your 200k context window can shrink to 70k with too many tools enabled.

Rule of thumb:
- Have 20-30 MCPs configured
- Keep under 10 enabled per project
- Under 80 tools active

### Customization

These configs work for C++20 HPC workflows. You should:
1. Start with what resonates
2. Modify for your specific HPC stack
3. Remove what you don't use
4. Add your own patterns

---

## Upstream

This is a C++20 HPC-adapted fork of [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code). We periodically sync with upstream and adapt new components for HPC workflows.

[![Star History Chart](https://api.star-history.com/svg?repos=affaan-m/everything-claude-code&type=Date)](https://star-history.com/#affaan-m/everything-claude-code&Date)

---

## License

MIT - Use freely, modify as needed, contribute back if you can.
