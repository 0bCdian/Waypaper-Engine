---
name: numpy-best-practices
description: Best practices for NumPy array programming, numerical computing, and performance optimization in Python
---

# NumPy Best Practices

Expert guidelines for NumPy development, focusing on array programming, numerical computing, and performance optimization.

## Code Style and Structure

- Write concise, technical Python code with accurate NumPy examples
- Prefer vectorized operations over explicit loops for performance
- Use descriptive variable names reflecting data content (e.g., `weights`, `gradients`, `input_array`)
- Follow PEP 8 style guidelines for Python code
- Use functional programming patterns when appropriate

## Array Creation and Manipulation

- Use appropriate array creation functions: `np.array()`, `np.zeros()`, `np.ones()`, `np.empty()`, `np.arange()`, `np.linspace()`
- Prefer `np.zeros()` or `np.empty()` for pre-allocation when array size is known
- Use `np.concatenate()`, `np.vstack()`, `np.hstack()` for combining arrays
- Leverage broadcasting for operations on arrays with different shapes

## Indexing and Slicing

- Use advanced indexing with boolean arrays for conditional selection
- Prefer views over copies when possible to save memory
- Use `np.where()` for conditional element selection
- Understand the difference between fancy indexing (creates copy) and basic slicing (creates view)

## Data Types

- Specify appropriate data types explicitly using `dtype` parameter
- Use `np.float32` for memory-efficient computations when full precision is not needed
- Be aware of integer overflow with fixed-size integer types
- Use `np.asarray()` for type conversion without unnecessary copies

## Performance Optimization

### Vectorization

- Always prefer vectorized operations over Python loops
- Use NumPy universal functions (ufuncs) for element-wise operations
- Leverage `np.einsum()` for complex tensor operations
- Use `np.dot()` or `@` operator for matrix multiplication

### Memory Management

- Use `np.ndarray.flags` to check memory layout (C-contiguous vs Fortran-contiguous)
- Prefer in-place operations with `out` parameter when possible
- Use memory-mapped arrays (`np.memmap`) for large datasets
- Be mindful of array copies vs views

### Computation Efficiency

- Use `np.sum()`, `np.mean()`, `np.std()` with `axis` parameter for aggregations
- Leverage `np.cumsum()`, `np.cumprod()` for cumulative operations
- Use `np.searchsorted()` for efficient sorted array operations

## Error Handling and Validation

- Validate input shapes and data types before computations
- Use assertions for dimension checking with informative messages
- Handle NaN and Inf values appropriately with `np.isnan()`, `np.isinf()`
- Use `np.errstate()` context manager for controlling floating-point error handling

## Random Number Generation

- Use `np.random.default_rng()` for modern random number generation
- Set seeds for reproducibility: `rng = np.random.default_rng(seed=42)`
- Prefer the new Generator API over legacy `np.random` functions
- Use appropriate distributions: `rng.normal()`, `rng.uniform()`, `rng.choice()`

## Linear Algebra

- Use `np.linalg` for linear algebra operations
- Leverage `np.linalg.solve()` instead of computing inverse for linear systems
- Use `np.linalg.eig()`, `np.linalg.svd()` for decompositions
- Check matrix condition with `np.linalg.cond()` before inversion

## Testing and Documentation

- Write unit tests using `pytest` with `np.testing` assertions
- Use `np.testing.assert_array_equal()` for exact comparisons
- Use `np.testing.assert_array_almost_equal()` for floating-point comparisons
- Include comprehensive docstrings following NumPy docstring format

## Key Conventions

- Import as `import numpy as np`
- Use `snake_case` for variables and functions
- Document array shapes in docstrings
- Profile code with `%timeit` to identify bottlenecks
