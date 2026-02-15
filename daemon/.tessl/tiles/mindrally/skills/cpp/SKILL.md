---
name: cpp
description: Guidelines for modern C++ development with C++17/20 standards, memory safety, and performance optimization
---

# C++ Development Guidelines

You are an expert in modern C++ development with deep knowledge of C++17/20 standards, memory management, and high-performance programming.

## Code Style and Structure

- Write clean, modern C++ code following C++17/20 standards
- Use meaningful variable and function names
- Follow the Single Responsibility Principle
- Prefer composition over inheritance
- Keep functions small and focused

## Naming Conventions

- Use PascalCase for classes and structs
- Use camelCase for functions, variables, and methods
- Use SCREAMING_SNAKE_CASE for constants and macros
- Use snake_case for namespaces
- Prefix member variables with `m_` or use trailing underscore

## Memory Management

### Smart Pointers
- Use `std::unique_ptr` for exclusive ownership
- Use `std::shared_ptr` only when shared ownership is required
- Use `std::weak_ptr` to break circular references
- Avoid raw owning pointers

### RAII (Resource Acquisition Is Initialization)
- Use RAII for all resource management
- Wrap resources in classes with proper destructors
- Ensure exception safety through RAII
- Use scope guards for cleanup operations

### Best Practices
- Prefer stack allocation over heap allocation
- Use `std::make_unique` and `std::make_shared`
- Avoid `new` and `delete` in application code
- Use containers instead of raw arrays

## Modern C++ Features

### C++17 Features
- Use structured bindings for tuple unpacking
- Use `std::optional` for values that may not exist
- Use `std::variant` for type-safe unions
- Use `if constexpr` for compile-time conditionals
- Use `std::string_view` for non-owning string references

### C++20 Features
- Use concepts for template constraints
- Use ranges for cleaner algorithms
- Use `std::span` for non-owning array views
- Use coroutines for asynchronous operations
- Use modules for faster compilation (when supported)

## Error Handling

- Use exceptions for error handling
- Define custom exception types for domain-specific errors
- Use `noexcept` for functions that don't throw
- Catch exceptions by const reference
- Provide strong exception guarantees where possible

## Performance

- Use `const` and `constexpr` liberally
- Prefer move semantics with `std::move`
- Use perfect forwarding with `std::forward`
- Avoid unnecessary copies
- Profile before optimizing
- Use `inline` for small frequently-called functions

## Security

### Buffer Safety
- Use `std::array` instead of C-style arrays
- Use `std::vector` with bounds checking
- Prefer `std::string` over C-style strings
- Use `std::span` for array views

### Type Safety
- Avoid C-style casts; use `static_cast`, `dynamic_cast`, etc.
- Use `enum class` instead of plain enums
- Use `nullptr` instead of `NULL`
- Enable compiler warnings and treat them as errors

## Concurrency

- Use `std::thread` and `std::jthread` for threading
- Use `std::mutex` and `std::lock_guard` for synchronization
- Use `std::atomic` for lock-free operations
- Prefer `std::async` for simple async operations
- Use condition variables for thread coordination

## Testing

- Write unit tests with Google Test or Catch2
- Use mocking frameworks like Google Mock
- Test edge cases and error conditions
- Use sanitizers (ASan, UBSan, TSan) during testing
- Implement continuous integration testing

## Documentation

- Use Doxygen-style comments for documentation
- Document public APIs thoroughly
- Include usage examples in documentation
- Keep documentation up to date with code changes
- Document thread safety requirements

## Build System

- Use CMake for cross-platform builds
- Organize code into logical modules
- Use package managers (vcpkg, Conan) for dependencies
- Enable compiler warnings and static analysis
- Configure proper debug and release builds
