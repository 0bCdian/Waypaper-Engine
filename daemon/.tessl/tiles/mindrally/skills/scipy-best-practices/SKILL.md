---
name: scipy-best-practices
description: Best practices for SciPy scientific computing, optimization, signal processing, and statistical analysis in Python
---

# SciPy Best Practices

Expert guidelines for SciPy development, focusing on scientific computing, optimization, signal processing, and statistical analysis.

## Code Style and Structure

- Write concise, technical Python code with accurate SciPy examples
- Prioritize numerical accuracy and computational efficiency
- Use functional programming patterns for mathematical operations
- Prefer vectorized operations over explicit loops
- Use descriptive variable names reflecting scientific context
- Follow PEP 8 style guidelines

## scipy.optimize - Optimization

- Use `scipy.optimize.minimize()` for general-purpose optimization
- Choose appropriate method based on problem characteristics:
  - `'BFGS'` for smooth, unconstrained problems
  - `'L-BFGS-B'` for bounded problems
  - `'SLSQP'` for constrained optimization
  - `'Nelder-Mead'` for non-differentiable functions
- Provide gradients when available for faster convergence
- Use `scipy.optimize.curve_fit()` for nonlinear least squares fitting
- Use `scipy.optimize.root()` for finding roots of equations

## scipy.linalg - Linear Algebra

- Prefer `scipy.linalg` over `numpy.linalg` for additional functionality
- Use `scipy.linalg.solve()` instead of computing matrix inverse
- Leverage specialized solvers for structured matrices (banded, triangular)
- Use `scipy.linalg.lu_factor()` and `lu_solve()` for multiple right-hand sides
- Use sparse matrix solvers from `scipy.sparse.linalg` for large sparse systems

## scipy.stats - Statistics

- Use distribution objects for probability calculations
- Leverage `scipy.stats.describe()` for summary statistics
- Use hypothesis testing functions: `ttest_ind()`, `chi2_contingency()`, `mannwhitneyu()`
- Generate random samples with `.rvs()` method on distributions
- Use `.fit()` for parameter estimation from data

## scipy.interpolate - Interpolation

- Use `scipy.interpolate.interp1d()` for 1D interpolation
- Use `scipy.interpolate.griddata()` for scattered data interpolation
- Choose appropriate interpolation method: 'linear', 'cubic', 'nearest'
- Use spline functions for smooth interpolation: `UnivariateSpline`, `BSpline`
- Consider `RegularGridInterpolator` for regular grid data

## scipy.integrate - Integration

- Use `scipy.integrate.quad()` for single integrals
- Use `scipy.integrate.dblquad()`, `tplquad()` for multiple integrals
- Use `scipy.integrate.solve_ivp()` for ordinary differential equations
- Choose appropriate ODE method: 'RK45', 'BDF', 'LSODA'
- Provide Jacobian for stiff systems to improve performance

## scipy.signal - Signal Processing

- Use `scipy.signal.butter()`, `cheby1()`, `ellip()` for filter design
- Apply filters with `scipy.signal.filtfilt()` for zero-phase filtering
- Use `scipy.signal.welch()` for power spectral density estimation
- Use `scipy.signal.find_peaks()` for peak detection
- Leverage `scipy.signal.convolve()` and `correlate()` for convolution

## scipy.sparse - Sparse Matrices

- Use appropriate sparse format for your use case:
  - `csr_matrix` for efficient row slicing and matrix-vector products
  - `csc_matrix` for efficient column slicing
  - `coo_matrix` for constructing sparse matrices
  - `lil_matrix` for incremental construction
- Convert to optimal format before operations
- Use `scipy.sparse.linalg` solvers for sparse linear systems

## Performance Optimization

- Use appropriate data types (`float64` for precision, `float32` for memory)
- Leverage BLAS/LAPACK through SciPy for optimized linear algebra
- Pre-allocate arrays when possible
- Use in-place operations when available

## Error Handling and Validation

- Check convergence status of optimization routines
- Validate numerical results for reasonableness
- Handle ill-conditioned problems gracefully
- Use appropriate tolerances for convergence criteria

## Testing Scientific Code

- Test against known analytical solutions
- Use `np.testing.assert_allclose()` for numerical comparisons
- Test edge cases and boundary conditions
- Verify conservation laws and invariants

## Key Conventions

- Import specific submodules: `from scipy import optimize, stats, linalg`
- Use `snake_case` for variables and functions
- Document algorithm choices and parameters
- Include convergence diagnostics in output
