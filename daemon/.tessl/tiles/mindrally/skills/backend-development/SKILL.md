---
name: backend-development
description: Guidelines for backend development in C++ and Elixir/Phoenix, covering modern language features, best practices, and production-ready patterns.
---

# Backend Development

You are an expert in backend development with C++ and Elixir/Phoenix.

## C++ Development

### Naming Conventions
- Use PascalCase for classes and structs
- Use camelCase for variables and methods
- Use SCREAMING_SNAKE_CASE for constants and macros

### Memory Management
- Prefer smart pointers (`std::unique_ptr`, `std::shared_ptr`) over raw pointers
- Use `std::unique_ptr` for exclusive ownership
- Use `std::shared_ptr` only when shared ownership is required
- Implement RAII for all resource management
- Avoid unnecessary heap allocations

### Modern C++ Features
- Use `auto` for type inference where it improves readability
- Leverage range-based for loops
- Use `std::optional` for values that may not exist
- Use `std::variant` for type-safe unions
- Apply structured bindings for cleaner code
- Use `std::move` for move semantics

### Error Handling
- Use exceptions for error handling
- Define custom exception types for domain-specific errors
- Catch exceptions at appropriate boundaries
- Ensure exception safety in all code

### Best Practices
- Enforce const-correctness throughout
- Avoid C-style casts; use `static_cast`, `dynamic_cast`, etc.
- Write unit tests with Google Test or Catch2
- Document with Doxygen comments

## Elixir and Phoenix Best Practices

### Core Philosophy
- Follow domain-driven design with PragDave philosophy
- Use functional programming with explicit error handling
- Embrace the "let it crash" principle

### Code Organization
- Organize code around business domains using Phoenix contexts
- Keep contexts focused on single domains
- Use bounded contexts to prevent coupling
- Implement clear public APIs for each context

### Pattern Matching and Control Flow
- Use pattern matching extensively for data extraction
- Apply "railway-oriented programming" with `with` statements
- Chain operations cleanly with the pipe operator
- Handle all pattern match cases explicitly

### Error Handling
- Return tagged tuples (`{:ok, result}` or `{:error, reason}`)
- Use `with` statements to chain fallible operations
- Implement proper supervision trees
- Handle expected errors explicitly

### Phoenix Contexts
- Group related functionality in contexts
- Define clear boundaries between contexts
- Use contexts as the API layer for business logic
- Keep controllers thin, delegate to contexts

### LiveView
- Use LiveView as primary UI technology
- Implement function components for reusable UI
- Handle events in LiveView modules
- Manage state appropriately in assigns

### Data Validation
- Validate at boundaries using `Ecto.Changeset`
- Use changesets even outside database contexts
- Define clear validation rules
- Return helpful error messages
