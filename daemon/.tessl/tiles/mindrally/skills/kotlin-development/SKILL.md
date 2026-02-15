---
name: kotlin-development
description: Kotlin development guidelines with best practices for clean code, naming conventions, function design, and data handling
---

# Kotlin Development Best Practices

## General Principles

- Use English for all code and documentation
- Always declare the type of each variable and function
- Avoid the `any` type; create necessary types instead
- No blank lines within function bodies

## Naming Conventions

### Case Standards
- **PascalCase**: Classes, interfaces, enums
- **camelCase**: Variables, functions, methods, parameters
- **UPPERCASE**: Environment variables, constants
- **underscores_case**: Files and directories

### Naming Guidelines
- Start each function with a verb (get, set, create, update, delete, etc.)
- Use complete words over abbreviations
  - Allowed abbreviations: API, URL, i/j for loops, err, ctx, req/res/next
- Avoid magic numbers; define constants instead
- Boolean variables use prefixes: `isLoading`, `hasError`, `canDelete`

## Function Design

### Size and Responsibility
- Keep functions under 20 instructions
- Each function should have a single responsibility
- Extract logic into utility functions when complexity increases

### Naming Functions
- Use verb-based naming that describes the action
- Prefix boolean-returning functions with `is`, `has`, or `can`
- Prefix void functions with action verbs like `execute`, `save`, `send`

### Reducing Nesting
- Use early returns to handle edge cases first
- Extract nested logic into separate functions
- Employ higher-order functions (map, filter, reduce) to minimize loops
- Prefer arrow functions for simple operations; use named functions otherwise

### Parameters
- Use default parameters instead of null checks
- When functions have multiple parameters, consolidate them into objects (RO-RO pattern)
- Keep parameter lists short (max 3-4 parameters)

## Data Handling

### Data Classes
- Use data classes for data structures
- Encapsulate primitive types in composite types when they represent domain concepts
- Validate data internally within data classes

### Immutability
- Prefer immutability for data
- Use `val` for variables that don't change
- Use immutable collections when possible
- Create new instances instead of mutating existing ones

## Classes and Objects

### Size Guidelines
- Keep classes under 200 instructions
- Limit to fewer than 10 public methods
- Limit to fewer than 10 properties

### Design Principles
- Follow SOLID principles
- Favor composition over inheritance
- Use interfaces for abstraction
- Keep classes focused on a single responsibility

## Exception Handling

### When to Use Exceptions
- Reserve exceptions for truly unexpected errors
- Don't use exceptions for control flow
- Catch exceptions only to:
  - Fix an anticipated issue
  - Add context before re-throwing

### Best Practices
- Create custom exception types for domain-specific errors
- Include meaningful error messages
- Log exceptions at appropriate levels

## Testing

### Unit Tests
- Follow Arrange-Act-Assert convention
- Write unit tests for all public functions
- Use test doubles (mocks, stubs, fakes) for dependencies
- Name tests descriptively to document behavior

### Acceptance Tests
- Follow Given-When-Then convention
- Test user-facing behavior and scenarios
- Keep tests independent and repeatable

## Code Organization

- Group related functionality together
- Keep files focused and cohesive
- Use packages/modules to organize code by feature or layer
- Maintain consistent file structure across the project
