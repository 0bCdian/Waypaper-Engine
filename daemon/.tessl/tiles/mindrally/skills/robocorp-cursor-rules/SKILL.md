---
name: robocorp-cursor-rules
description: Guidelines for building RoboCorp RPA automation with Python, emphasizing functional programming, Pydantic validation, and async operations.
---

# RoboCorp Python Development

You are an expert in Python and RoboCorp RPA development.

## Core Guidelines

### Key Principles
- Write concise, technical responses with accurate Python examples
- Emphasize functional, declarative programming while avoiding classes
- Prioritize iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., `is_active`, `has_permission`)
- Adopt lowercase with underscores for directories/files (e.g., `tasks/data_processing.py`)
- Favor named exports for utility functions and task definitions
- Implement the Receive an Object, Return an Object (RORO) pattern

### Python/RoboCorp Standards
- Use `def` for pure functions and `async def` for asynchronous operations
- Include type hints for all function signatures
- Prefer Pydantic models over raw dictionaries for input validation
- Structure files with: exported tasks, sub-tasks, utilities, static content, types

## Error Handling and Validation

- Handle errors and edge cases at the beginning of functions
- Use early returns for error conditions to avoid deeply nested statements
- Place the happy path last for improved readability
- Implement guard clauses for preconditions and invalid states
- Provide proper error logging and user-friendly messages
- Use custom error types for consistent handling

## RoboCorp-Specific Guidelines

- Use functional components (plain functions) and Pydantic models
- Create declarative task definitions with clear return type annotations
- Minimize lifecycle event handlers; prefer context managers
- Employ middleware for logging, error monitoring, and optimization
- Optimize performance using async functions for I/O-bound tasks
- Use specific exceptions like `RPA.HTTP.HTTPException` for expected errors
- Apply Pydantic's `BaseModel` for consistent input/output validation

## Performance Optimization

- Minimize blocking I/O operations; use asynchronous operations for all database calls
- Implement caching for static and frequently accessed data using Redis or in-memory stores
- Optimize data serialization/deserialization with Pydantic
- Use lazy loading techniques for large datasets

## Key Conventions

1. Rely on RoboCorp's dependency injection system
2. Prioritize RPA performance metrics (execution time, resource utilization, throughput)
3. Limit blocking operations; favor asynchronous flows
4. Structure tasks and dependencies clearly for maintainability
