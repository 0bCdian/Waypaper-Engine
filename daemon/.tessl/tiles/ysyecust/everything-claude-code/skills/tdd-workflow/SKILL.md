---
name: tdd-workflow
description: Use this skill when writing new features, fixing bugs, or refactoring C++20 code. Enforces test-driven development with Google Test/Mock, CMake/CTest integration, and 80%+ coverage via gcov/lcov.
---

# Test-Driven Development Workflow (C++20)

This skill ensures all C++ code development follows TDD principles with comprehensive test coverage using Google Test and CTest.

## When to Activate

- Writing new features or functionality
- Fixing bugs or issues
- Refactoring existing code
- Adding new classes or algorithms
- Creating new solver components

## Core Principles

### 1. Tests BEFORE Code
ALWAYS write tests first, then implement code to make tests pass.

### 2. Coverage Requirements
- Minimum 80% coverage (unit + integration)
- All edge cases covered
- Error scenarios tested
- Boundary conditions verified

### 3. Test Types

#### Unit Tests (Google Test)
- Individual functions and classes
- Template instantiations
- Algorithm correctness
- Edge cases and error paths

#### Integration Tests (CTest)
- Multi-component interactions
- I/O operations
- MPI communication patterns
- End-to-end solver pipelines

#### Performance Tests
- Scalability benchmarks
- Cache efficiency validation
- Regression detection

## TDD Workflow Steps

### Step 1: Define Interface
```cpp
// include/project/solver/cg_solver.hpp
#pragma once
#include <span>

namespace hpc::solver {

struct CgConfig {
  int max_iter = 1000;
  double tolerance = 1e-10;
};

class CgSolver {
public:
  explicit CgSolver(CgConfig config = {});

  /// @return Number of iterations performed.
  [[nodiscard]] int Solve(std::span<double> x, std::span<const double> b);

  [[nodiscard]] double Residual() const;

private:
  CgConfig config_;
  double residual_ = 0.0;
};

}  // namespace hpc::solver
```

### Step 2: Write Failing Test (RED)
```cpp
// tests/unit/test_cg_solver.cpp
#include <gtest/gtest.h>
#include "project/solver/cg_solver.hpp"

namespace hpc::solver {
namespace {

class CgSolverTest : public ::testing::Test {
protected:
  void SetUp() override {
    // Identity system: solution is b itself
    b_ = {1.0, 2.0, 3.0};
    x_.resize(b_.size(), 0.0);
  }

  std::vector<double> x_;
  std::vector<double> b_;
};

TEST_F(CgSolverTest, SolvesIdentitySystem) {
  CgSolver solver({.max_iter = 100, .tolerance = 1e-12});
  int iters = solver.Solve(x_, b_);

  EXPECT_LE(iters, 1);
  EXPECT_NEAR(x_[0], 1.0, 1e-10);
  EXPECT_NEAR(x_[1], 2.0, 1e-10);
  EXPECT_NEAR(x_[2], 3.0, 1e-10);
}

TEST_F(CgSolverTest, ReportsResidual) {
  CgSolver solver;
  solver.Solve(x_, b_);

  EXPECT_LT(solver.Residual(), 1e-10);
}

TEST_F(CgSolverTest, RespectsMaxIterations) {
  CgSolver solver({.max_iter = 2, .tolerance = 1e-20});
  int iters = solver.Solve(x_, b_);

  EXPECT_LE(iters, 2);
}

TEST_F(CgSolverTest, HandlesEmptyInput) {
  CgSolver solver;
  std::vector<double> empty_x, empty_b;

  int iters = solver.Solve(empty_x, empty_b);
  EXPECT_EQ(iters, 0);
}

}  // namespace
}  // namespace hpc::solver
```

### Step 3: Run Test (Verify FAIL)
```bash
cmake -B build -DBUILD_TESTING=ON
cmake --build build
ctest --test-dir build -R test_cg_solver --output-on-failure
# Tests should FAIL - not implemented yet
```

### Step 4: Implement Minimal Code (GREEN)
```cpp
// src/solver/cg_solver.cpp
#include "project/solver/cg_solver.hpp"
#include <cmath>
#include <numeric>

namespace hpc::solver {

CgSolver::CgSolver(CgConfig config) : config_(config) {}

int CgSolver::Solve(std::span<double> x, std::span<const double> b) {
  if (x.empty()) return 0;

  // Minimal implementation for identity system
  std::copy(b.begin(), b.end(), x.begin());
  residual_ = 0.0;
  return 1;
}

double CgSolver::Residual() const { return residual_; }

}  // namespace hpc::solver
```

### Step 5: Run Test (Verify PASS)
```bash
cmake --build build
ctest --test-dir build -R test_cg_solver --output-on-failure
# All tests should PASS
```

### Step 6: Refactor (IMPROVE)
Improve implementation while keeping tests green.

### Step 7: Verify Coverage
```bash
cmake -B build-cov -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_CXX_FLAGS="--coverage -fprofile-arcs -ftest-coverage"
cmake --build build-cov
ctest --test-dir build-cov
lcov --capture --directory build-cov --output-file coverage.info
lcov --remove coverage.info '/usr/*' '*/test/*' --output-file coverage.info
genhtml coverage.info --output-directory coverage_report
# Verify 80%+ coverage
```

## Google Mock Integration

### Mocking Interfaces
```cpp
#include <gmock/gmock.h>
#include "project/io/data_reader.hpp"

class MockDataReader : public IDataReader {
public:
  MOCK_METHOD(std::vector<double>, ReadVector, (const std::string& path), (override));
  MOCK_METHOD(bool, FileExists, (const std::string& path), (const, override));
};

TEST(SolverIntegration, HandlesIOFailure) {
  MockDataReader reader;
  EXPECT_CALL(reader, FileExists("input.dat"))
      .WillOnce(::testing::Return(false));

  Solver solver(&reader);
  EXPECT_THROW(solver.LoadAndSolve("input.dat"), std::runtime_error);
}
```

### Parameterized Tests
```cpp
class NormTest : public ::testing::TestWithParam<
    std::tuple<std::vector<double>, double>> {};

TEST_P(NormTest, ComputesCorrectly) {
  auto [input, expected] = GetParam();
  EXPECT_NEAR(ComputeL2Norm(input), expected, 1e-10);
}

INSTANTIATE_TEST_SUITE_P(NormCases, NormTest,
    ::testing::Values(
        std::make_tuple(std::vector<double>{3.0, 4.0}, 5.0),
        std::make_tuple(std::vector<double>{1.0, 0.0}, 1.0),
        std::make_tuple(std::vector<double>{}, 0.0)
    ));
```

## CMakeLists.txt for Tests

```cmake
# tests/CMakeLists.txt
include(FetchContent)

FetchContent_Declare(
  googletest
  GIT_REPOSITORY https://github.com/google/googletest.git
  GIT_TAG v1.14.0
)
FetchContent_MakeAvailable(googletest)

enable_testing()

# Unit tests
add_executable(test_cg_solver unit/test_cg_solver.cpp)
target_link_libraries(test_cg_solver PRIVATE
  project::solver
  GTest::gtest_main
  GTest::gmock
)
add_test(NAME test_cg_solver COMMAND test_cg_solver)

# Integration tests (labeled)
add_executable(test_solver_pipeline integration/test_solver_pipeline.cpp)
target_link_libraries(test_solver_pipeline PRIVATE
  project::solver
  project::io
  GTest::gtest_main
)
add_test(NAME test_solver_pipeline COMMAND test_solver_pipeline)
set_tests_properties(test_solver_pipeline PROPERTIES LABELS "integration")
```

## Test File Organization

```
tests/
├── CMakeLists.txt
├── unit/
│   ├── test_cg_solver.cpp
│   ├── test_matrix.cpp
│   ├── test_preconditioner.cpp
│   └── test_mesh.cpp
├── integration/
│   ├── test_solver_pipeline.cpp
│   ├── test_io_roundtrip.cpp
│   └── test_mpi_communication.cpp
└── benchmarks/
    ├── bench_matvec.cpp
    └── bench_solver.cpp
```

## Best Practices

1. **Write Tests First** - Always TDD
2. **One Assert Per Test** - Focus on single behavior
3. **Descriptive Test Names** - Explain what's tested
4. **Arrange-Act-Assert** - Clear test structure
5. **Mock External Dependencies** - Isolate unit tests
6. **Test Edge Cases** - Empty, zero, max, negative
7. **Test Error Paths** - Not just happy paths
8. **Keep Tests Fast** - Unit tests < 10ms each
9. **Clean Up After Tests** - No side effects between tests
10. **Review Coverage Reports** - Identify gaps

---

**Remember**: Tests are not optional. They are the safety net that enables confident refactoring, rapid development, and production reliability.
