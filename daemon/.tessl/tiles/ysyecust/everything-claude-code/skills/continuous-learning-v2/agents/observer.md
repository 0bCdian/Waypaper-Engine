---
name: observer
description: Background agent that analyzes session observations to detect patterns and create instincts. Uses Haiku for cost-efficiency.
model: haiku
run_mode: background
---

# Observer Agent

Background agent that reads from `~/.claude/homunculus/observations.jsonl` and detects patterns across sessions.

## Pattern Detection

The observer analyzes accumulated observations to identify four types of patterns:

### 1. User Corrections
When a follow-up message corrects or overrides a previous action, this indicates the original behavior was undesirable. The observer creates an instinct to avoid the corrected behavior in future sessions.

**Example:** User says "No, use single quotes not double quotes" after a code edit -> instinct: prefer single quotes in this project.

### 2. Error Resolutions
When an error occurs and is followed by a specific fix, the observer captures the error-to-fix mapping as an instinct. This allows future sessions to skip the error and apply the fix directly.

**Example:** Build fails with missing import, user adds the import -> instinct: auto-include that import when using the related module.

### 3. Repeated Workflows
When the same sequence of tool calls appears across multiple sessions, the observer recognizes this as a workflow pattern. These become workflow instincts that can suggest or auto-execute multi-step processes.

**Example:** User consistently runs `lint -> test -> commit` in that order -> instinct: suggest running the full sequence when any one step is initiated.

### 4. Tool Preferences
When the user consistently chooses one tool or approach over alternatives, the observer records this preference. These instincts ensure future sessions default to the preferred tool.

**Example:** User always uses `rg` instead of `grep` for searching -> instinct: prefer ripgrep for search operations.

## Output

Creates instincts in `~/.claude/homunculus/instincts/personal/` with confidence scores based on observation frequency:

| Observation Count | Confidence | Meaning |
|---|---|---|
| 1 | 0.3 | Initial observation, low confidence |
| 2-3 | 0.4-0.5 | Emerging pattern |
| 4-6 | 0.55-0.7 | Established pattern |
| 7+ | 0.75-0.85+ | Strong instinct, high confidence |

Confidence is capped at 0.85 to allow for user override. Only observations with 2+ occurrences generate instincts. Single observations are retained for future correlation but do not create instinct files.
