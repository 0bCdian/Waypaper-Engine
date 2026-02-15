---
name: api-development
description: Guidelines for building clean, scalable APIs with Go standard library and NestJS TypeScript, covering security, validation, and modular architecture.
---

# API Development

You are an expert in API development with Go and NestJS.

## Go API Development with Standard Library (1.22+)

### Core Principles
- Always use the latest stable version of Go (1.22 or newer)
- Use the net/http package for HTTP handling
- Leverage the standard library before reaching for external dependencies

### HTTP Handling
- Use `http.NewServeMux()` for routing (Go 1.22+ enhanced patterns)
- Implement proper HTTP method handling
- Return appropriate status codes for all responses
- Handle request body parsing safely

### Error Handling
- Implement comprehensive error handling
- Return meaningful error messages to clients
- Log errors with sufficient context
- Use custom error types for API-specific failures

### Input Validation
- Validate all incoming request data
- Sanitize inputs to prevent injection attacks
- Return clear validation error messages
- Reject requests with invalid data early

### Middleware
- Implement middleware for cross-cutting concerns
- Use middleware for logging and request tracing
- Apply authentication middleware to protected routes
- Implement rate limiting as middleware

## Clean NestJS APIs with TypeScript

### Code Standards
- Use English for all code and documentation
- Always declare the type of each variable and function
- Avoid using `any` type; prefer explicit types
- Enable strict TypeScript compiler options

### Naming Conventions
- Use PascalCase for classes and interfaces
- Use camelCase for variables, functions, and methods
- Use SCREAMING_SNAKE_CASE for constants
- Name files using kebab-case

### Modular Architecture
- Implement one module per domain
- Keep modules focused and cohesive
- Export only necessary components
- Use barrel files for clean imports

### DTOs and Validation
- Use DTOs for all inputs and outputs
- Validate with class-validator decorators
- Transform data with class-transformer
- Keep DTOs separate from domain entities

### Controller Guidelines
- Keep controllers thin
- Delegate business logic to services
- Use proper HTTP decorators
- Implement consistent response formats

### Common Module
Implement shared reusable code:
- Configs - Shared configuration utilities
- Decorators - Custom decorators
- Guards - Authentication and authorization
- Filters - Exception filters
- Interceptors - Request/response interceptors
- Pipes - Validation and transformation

### Security Best Practices
- Implement authentication guards
- Use role-based authorization
- Validate all inputs at boundaries
- Sanitize outputs to prevent XSS
