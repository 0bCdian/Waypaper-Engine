---
name: iterative-retrieval
description: Pattern for progressively refining context retrieval to solve the subagent context problem
---

# Iterative Retrieval Pattern

Solves the "context problem" in multi-agent workflows where subagents don't know what context they need until they start working.

## The Problem

Subagents are spawned with limited context. They don't know:
- Which files contain relevant code
- What patterns exist in the codebase
- What terminology the project uses

Standard approaches fail:
- **Send everything**: Exceeds context limits
- **Send nothing**: Agent lacks critical information
- **Guess what's needed**: Often wrong

## The Solution: Iterative Retrieval

A 4-phase loop that progressively refines context:

```
┌─────────────────────────────────────────────┐
│                                             │
│   ┌──────────┐      ┌──────────┐            │
│   │ DISPATCH │─────▶│ EVALUATE │            │
│   └──────────┘      └──────────┘            │
│        ▲                  │                 │
│        │                  ▼                 │
│   ┌──────────┐      ┌──────────┐            │
│   │   LOOP   │◀─────│  REFINE  │            │
│   └──────────┘      └──────────┘            │
│                                             │
│        Max 3 cycles, then proceed           │
└─────────────────────────────────────────────┘
```

### Phase 1: DISPATCH

Initial broad query to gather candidate files:

```
Start with high-level intent:
  patterns: src/**/*.cpp, include/**/*.hpp
  keywords: relevant domain terms
  excludes: *_test.cpp, *_bench.cpp
```

### Phase 2: EVALUATE

Assess retrieved content for relevance:

Scoring criteria:
- **High (0.8-1.0)**: Directly implements target functionality
- **Medium (0.5-0.7)**: Contains related patterns or types
- **Low (0.2-0.4)**: Tangentially related
- **None (0-0.2)**: Not relevant, exclude

### Phase 3: REFINE

Update search criteria based on evaluation:
- Add new patterns discovered in high-relevance files
- Add terminology found in codebase
- Exclude confirmed irrelevant paths
- Target specific gaps

### Phase 4: LOOP

Repeat with refined criteria (max 3 cycles).

Stop when:
- 3+ high-relevance files found
- No critical gaps remain
- Max cycles reached

## Practical Examples

### Example 1: Bug Fix Context

```
Task: "Fix the memory leak in the particle solver"

Cycle 1:
  DISPATCH: Search for "particle", "solver", "allocat" in src/**
  EVALUATE: Found particle_solver.cpp (0.9), memory_pool.hpp (0.8), main.cpp (0.3)
  REFINE: Add "arena", "pool" keywords; exclude main.cpp

Cycle 2:
  DISPATCH: Search refined terms
  EVALUATE: Found arena_allocator.hpp (0.95), smart_ptr_utils.hpp (0.85)
  REFINE: Sufficient context (4 high-relevance files)

Result: particle_solver.cpp, memory_pool.hpp, arena_allocator.hpp, smart_ptr_utils.hpp
```

### Example 2: Feature Implementation

```
Task: "Add MPI communication to the mesh partitioner"

Cycle 1:
  DISPATCH: Search "MPI", "mesh", "partition" in src/**
  EVALUATE: No matches for "MPI" - codebase uses "comm" namespace
  REFINE: Add "comm::", "distribute", "scatter" keywords

Cycle 2:
  DISPATCH: Search refined terms
  EVALUATE: Found comm_layer.hpp (0.9), mesh_partition.cpp (0.7)
  REFINE: Need data serialization patterns

Cycle 3:
  DISPATCH: Search "serialize", "pack", "buffer" patterns
  EVALUATE: Found serializer.hpp (0.8)
  REFINE: Sufficient context

Result: comm_layer.hpp, mesh_partition.cpp, serializer.hpp
```

## Integration with Agents

Use in agent prompts:

```markdown
When retrieving context for this task:
1. Start with broad keyword search
2. Evaluate each file's relevance (0-1 scale)
3. Identify what context is still missing
4. Refine search criteria and repeat (max 3 cycles)
5. Return files with relevance >= 0.7
```

## Best Practices

1. **Start broad, narrow progressively** - Don't over-specify initial queries
2. **Learn codebase terminology** - First cycle often reveals naming conventions
3. **Track what's missing** - Explicit gap identification drives refinement
4. **Stop at "good enough"** - 3 high-relevance files beats 10 mediocre ones
5. **Exclude confidently** - Low-relevance files won't become relevant
