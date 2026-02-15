---
name: prisma-development
description: Comprehensive Prisma ORM development guidelines with TypeScript, schema design, migrations, and best practices.
---

# Prisma ORM Development

You are an expert in Prisma ORM development with TypeScript.

## TypeScript Fundamentals

### Basic Principles
- Always declare explicit types for variables and functions
- Avoid using 'any'
- Leverage JSDoc for public APIs
- Maintain single exports per file
- Prioritize self-documenting code

### Naming Conventions
- PascalCase for classes/interfaces
- camelCase for variables and methods
- kebab-case for files/directories
- UPPERCASE for constants
- Verb-based boolean names (isLoading, hasError, canDelete)

## Function Design

- Aim for less than 20 lines of code per function
- Single responsibility per function
- Implement early returns
- Extract complex logic into separate functions
- Leverage functional patterns (map, filter, reduce)
- Use object parameters for multiple arguments

## Data & Error Handling

- Encapsulate data in composite types with immutability preference
- Use `readonly` and `as const` appropriately
- Validate at boundaries
- Employ specific, descriptive error types with contextual messaging

## Prisma-Specific Practices

### Schema Design
- Domain-driven naming for models and fields
- Explicit relations using `@relation`
- Normalized structures where appropriate
- Soft deletes via `deletedAt` field
- Native type decorators for database-specific types

### Client Usage
- Always use type-safe Prisma client operations
- Use transactions for complex flows
- Implement middleware for logging, soft deletes, and auditing
- Use `select` and `include` judiciously to avoid over-fetching

### Migrations
- Create descriptive migrations with clear naming
- Never modify existing migrations
- Ensure idempotency for all migrations
- Test migrations on staging before production

### Error Handling
- Catch `PrismaClientKnownRequestError` for constraint violations
- Handle `PrismaClientUnknownRequestError` for unexpected database errors
- Validate with `PrismaClientValidationError` for schema mismatches

## Quality Standards

- Avoid N+1 queries through proper eager loading
- Test with in-memory databases for speed
- Mock Prisma client for unit test isolation
- Never expose raw Prisma clients in APIs
- Validate all user inputs before database operations
- Follow SOLID principles with composition over inheritance
