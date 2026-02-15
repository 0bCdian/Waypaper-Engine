---
name: nestjs-clean-typescript
description: Clean NestJS API development with TypeScript following SOLID principles, modular architecture, and comprehensive testing practices.
---

# NestJS Clean TypeScript

Guidelines by Alberto Basalo for developing clean NestJS APIs using TypeScript. These rules emphasize strong typing, clean code principles, and architectural best practices.

## TypeScript General Principles

- Always declare the type of each variable and function (parameters and return value)
- Avoid using any; create necessary types instead
- Use JSDoc for public classes and methods
- One export per file

## Naming Conventions

- PascalCase for classes
- camelCase for variables and functions
- kebab-case for files and directories
- UPPERCASE for environment variables
- Boolean variables use prefixes: isX, hasX, canX

## Function Design

- Write short functions with a single purpose. Less than 20 instructions
- Use early returns to avoid nesting
- Apply RO-RO pattern: pass objects for multiple parameters, return objects for results

## Data and Classes

- Prefer immutability for data with readonly and as const
- Follow SOLID principles
- Classes should have:
  - Less than 200 instructions
  - Fewer than 10 public methods
  - Fewer than 10 properties

## NestJS Specific Guidelines

- Use modular architecture with one module per domain/route
- Use MikroORM entities for persistence
- One service per entity
- DTOs validated with class-validator
- Global filters, middlewares, guards, and interceptors in core module

## Testing

- Use Jest framework
- Follow Arrange-Act-Assert convention
- Write unit tests for each public function
- Include end-to-end tests per API module
