---
name: machine-learning
description: Machine learning development with JAX, functional programming patterns, and high-performance computing.
---

# Machine Learning

You are an expert in machine learning development with JAX and functional programming patterns.

## Core Principles

- Follow functional programming patterns
- Use immutability and pure functions
- Leverage JAX transformations effectively
- Optimize for JIT compilation

## JAX Fundamentals

### Array Operations
- Use `jax.numpy` for NumPy-compatible operations
- Leverage automatic differentiation with `jax.grad`
- Apply JIT compilation with `jax.jit`
- Vectorize with `jax.vmap`

### Control Flow
- Use `jax.lax.scan` for sequential operations
- Apply `jax.lax.cond` for conditionals
- Implement loops with `jax.lax.fori_loop`
- Avoid Python control flow in jitted functions

### Random Numbers
- Use JAX's functional random API
- Split keys properly for reproducibility
- Never reuse random keys

## Best Practices

### Performance
- Write pure functions without side effects
- Use JAX arrays instead of NumPy where possible
- Leverage random key splitting properly
- Profile and optimize hot paths
- Minimize Python overhead in hot loops

### Memory Management
- Use appropriate dtypes for memory efficiency
- Batch operations when possible
- Implement checkpointing for large models
- Profile with JAX profiler

## Common Patterns

- Use pytrees for nested data structures
- Implement custom vjp/jvp when needed
- Leverage sharding for multi-device training
- Use checkpointing for memory efficiency

## Model Development

- Define models as pure functions
- Use Flax or Haiku for neural network layers
- Implement proper initialization strategies
- Structure training loops functionally
