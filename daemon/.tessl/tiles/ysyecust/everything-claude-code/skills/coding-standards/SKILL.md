---
name: coding-standards
description: C++20 coding standards, naming conventions, concepts, ranges, constexpr, file organization, and Doxygen documentation practices for high-performance computing.
---

# C++20 Coding Standards & Best Practices

Universal coding standards for C++20 HPC projects following Google C++ Style and C++ Core Guidelines.

## Code Quality Principles

### 1. Readability First
- Code is read more than written
- Clear variable and function names (Google C++ Style)
- Self-documenting code preferred over comments
- Consistent formatting (clang-format)

### 2. KISS (Keep It Simple, Stupid)
- Simplest solution that works
- Avoid over-engineering
- No premature optimization
- Easy to understand > clever code

### 3. DRY (Don't Repeat Yourself)
- Extract common logic into functions
- Create reusable templates
- Share utilities across modules
- Avoid copy-paste programming

### 4. YAGNI (You Aren't Gonna Need It)
- Don't build features before they're needed
- Avoid speculative generality
- Add complexity only when required
- Start simple, refactor when needed

## Naming Conventions (Google C++ Style)

### Types and Classes

```cpp
// PascalCase for types
class ParticleSystem;
struct MeshConfig;
enum class IntegrationMethod { kExplicitEuler, kRK4, kVerlet };

// Template parameters: single uppercase or PascalCase
template <typename T>
template <typename ValueType>
```

### Functions

```cpp
// PascalCase for functions
void ComputeForces(std::span<Particle> particles);
double CalculateEnergy(const SimState& state);
[[nodiscard]] bool IsConverged(double residual, double tol);

// Accessors: no Get prefix for simple getters
class Mesh {
public:
  int NumVertices() const { return vertices_.size(); }
  double TimeStep() const { return dt_; }
  void SetTimeStep(double dt) { dt_ = dt; }
};
```

### Variables

```cpp
// snake_case for local and function parameters
int particle_count = 1000;
double time_step = 0.01;
const auto& mesh_data = solver.GetMesh();

// kPascalCase for constants
constexpr int kMaxIterations = 10000;
constexpr double kBoltzmannConstant = 1.380649e-23;
static constexpr size_t kCacheLineSize = 64;

// Trailing underscore for member variables
class Solver {
private:
  int max_iter_;
  double tolerance_;
  std::vector<double> residuals_;
};
```

### Namespaces and Files

```cpp
// snake_case for namespaces
namespace hpc::solver {}
namespace hpc::io {}

// snake_case for file names
// particle_system.hpp / particle_system.cpp
// conjugate_gradient.hpp / conjugate_gradient.cpp
```

## C++20 Concepts

```cpp
// Define domain-specific concepts
template <typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

template <typename T>
concept LinearOperator = requires(T op, std::span<double> x, std::span<const double> y) {
  { op.Apply(x, y) } -> std::same_as<void>;
  { op.NumRows() } -> std::convertible_to<size_t>;
  { op.NumCols() } -> std::convertible_to<size_t>;
};

template <typename T>
concept Serializable = requires(T obj, std::ostream& os, std::istream& is) {
  { obj.Serialize(os) } -> std::same_as<void>;
  { T::Deserialize(is) } -> std::same_as<T>;
};

// Use concepts as constraints
template <LinearOperator Op>
void SolveSystem(const Op& A, std::span<double> x, std::span<const double> b) {
  // Generic solver implementation
}
```

## C++20 Ranges

```cpp
#include <ranges>
#include <algorithm>

// Filter and transform with ranges
auto active_particles = particles
    | std::views::filter([](const Particle& p) { return p.IsActive(); })
    | std::views::transform([](const Particle& p) { return p.Position(); });

// Compose views for data pipelines
auto high_energy = simulation_data
    | std::views::filter([threshold](double e) { return e > threshold; })
    | std::views::take(100);

// Range algorithms
std::ranges::sort(particles, {}, &Particle::Energy);
auto it = std::ranges::find_if(nodes, [](const Node& n) { return n.IsLeaf(); });
double total = std::ranges::fold_left(values, 0.0, std::plus<>{});
```

## constexpr and Compile-Time Computation

```cpp
// Compile-time constants
constexpr double kPi = 3.14159265358979323846;
constexpr size_t kBlockSize = 256;

// constexpr functions
constexpr int Factorial(int n) {
  return n <= 1 ? 1 : n * Factorial(n - 1);
}

// consteval for guaranteed compile-time evaluation
consteval size_t AlignTo(size_t size, size_t alignment) {
  return (size + alignment - 1) & ~(alignment - 1);
}

// if constexpr for compile-time branching
template <typename T>
void ProcessData(std::span<T> data) {
  if constexpr (std::is_floating_point_v<T>) {
    // Vectorized floating-point path
  } else if constexpr (std::is_integral_v<T>) {
    // Integer path
  }
}
```

## File Organization

### Header Files (.hpp)

```cpp
#pragma once  // Or include guards

#include <vector>      // Standard library first
#include <span>

#include "project/core/types.hpp"  // Project headers second

namespace hpc::solver {

/// @brief Conjugate Gradient solver for symmetric positive-definite systems.
///
/// Solves Ax = b using the preconditioned CG method.
/// @tparam Precond Preconditioner type satisfying LinearOperator concept.
template <LinearOperator Precond = IdentityPrecond>
class ConjugateGradient {
public:
  struct Config {
    int max_iter = 1000;
    double tolerance = 1e-10;
    bool verbose = false;
  };

  explicit ConjugateGradient(Config config = {});

  /// @brief Solve the system Ax = b.
  /// @param A The system matrix (LinearOperator).
  /// @param x Solution vector (initial guess on input, solution on output).
  /// @param b Right-hand side vector.
  /// @return Number of iterations performed.
  [[nodiscard]] int Solve(const auto& A, std::span<double> x,
                          std::span<const double> b);

private:
  Config config_;
  Precond precond_;
};

}  // namespace hpc::solver
```

### Source Files (.cpp)

```cpp
#include "project/solver/conjugate_gradient.hpp"

#include <cmath>
#include <numeric>

namespace hpc::solver {

template <LinearOperator Precond>
ConjugateGradient<Precond>::ConjugateGradient(Config config)
    : config_(std::move(config)) {}

template <LinearOperator Precond>
int ConjugateGradient<Precond>::Solve(
    const auto& A, std::span<double> x, std::span<const double> b) {
  // Implementation
}

}  // namespace hpc::solver
```

## Doxygen Documentation

```cpp
/// @file particle_system.hpp
/// @brief N-body particle system simulation.

/// @brief Represents a single particle in the simulation.
///
/// Stores position, velocity, and force for a particle
/// with mass in a 3D domain.
struct Particle {
  std::array<double, 3> position;   ///< Position in 3D space [m].
  std::array<double, 3> velocity;   ///< Velocity [m/s].
  std::array<double, 3> force;      ///< Accumulated force [N].
  double mass;                       ///< Particle mass [kg].
};

/// @brief Compute pairwise forces between all particles.
/// @param particles Span of particles to update.
/// @param cutoff_radius Maximum interaction distance [m].
/// @pre All particles must have positive mass.
/// @post force field of each particle is updated.
/// @complexity O(N^2) for brute-force, O(N log N) with tree.
void ComputeForces(std::span<Particle> particles, double cutoff_radius);
```

## Code Smell Detection

### 1. Raw new/delete
```cpp
// BAD
auto* p = new Particle[n];
delete[] p;

// GOOD
auto particles = std::make_unique<Particle[]>(n);
// Or better:
std::vector<Particle> particles(n);
```

### 2. C-style Casts
```cpp
// BAD
double* ptr = (double*)void_ptr;

// GOOD
auto* ptr = static_cast<double*>(void_ptr);
// Or reinterpret_cast when truly needed (with comment explaining why)
```

### 3. Magic Numbers
```cpp
// BAD
if (iter > 10000) break;
double dt = 0.001;

// GOOD
constexpr int kMaxIterations = 10000;
constexpr double kDefaultTimeStep = 0.001;
```

### 4. Deep Nesting
```cpp
// BAD: 5+ levels
if (rank == 0) {
  if (config.verbose) {
    for (auto& p : particles) {
      if (p.IsActive()) {
        if (p.Energy() > threshold) {
          // ...
        }
      }
    }
  }
}

// GOOD: Early returns + ranges
if (rank != 0 || !config.verbose) return;

auto high_energy = particles
    | std::views::filter(&Particle::IsActive)
    | std::views::filter([&](const Particle& p) { return p.Energy() > threshold; });

for (const auto& p : high_energy) {
  // ...
}
```

**Remember**: Code quality is not negotiable. Clear, maintainable code enables rapid development and confident refactoring.
