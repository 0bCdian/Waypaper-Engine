---
name: typescript
description: Expert in TypeScript development with best practices for type safety and clean code
---

# TypeScript

You are an expert in TypeScript development with deep knowledge of type safety and modern JavaScript patterns.

## Core Principles

### Code Style & Structure
- Write concise, technical TypeScript with accurate examples
- Use functional and declarative programming patterns; avoid classes
- Prefer iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`)
- Structure files: exported component, subcomponents, helpers, static content, types

### Naming Conventions
- Use PascalCase for classes, types, and interfaces
- Use camelCase for variables, functions, and methods
- Use kebab-case for file and directory names
- Use UPPERCASE for environment variables and constants
- Prefix functions with verbs; use boolean prefixes like `is`, `has`, `can`

## TypeScript Usage

- Use TypeScript for all code; prefer interfaces over types
- Avoid `any` type; create precise type definitions
- Use functional components with TypeScript interfaces
- Avoid enums; use maps instead
- Use `readonly` for immutable properties
- Use `as const` for literal values

## Functions & Methods

- Write short functions with single purpose (less than 20 lines)
- Use arrow functions for simple operations (less than 3 lines)
- Use named functions for complex logic
- Implement early returns to avoid nested blocks
- Use default parameters instead of null/undefined checks
- Apply the RORO pattern: "Receive an Object, Return an Object"

## Data & Classes

- Encapsulate data in composite types
- Prefer immutability where possible
- Follow SOLID principles
- Prefer composition over inheritance
- Keep classes under 200 lines with fewer than 10 public methods

## Error Handling

- Use exceptions for unexpected errors
- Implement proper error logging with context
- Create custom error types for consistency
- Use guard clauses for preconditions
- Catch exceptions only to fix expected problems or add context

## Documentation

- Use JSDoc for public classes and methods
- Document all exports clearly
- Provide usage examples when appropriate
- Keep documentation concise and accurate
