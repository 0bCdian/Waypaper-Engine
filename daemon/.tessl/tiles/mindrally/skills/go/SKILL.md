---
name: go
description: Expert in Go/Golang development with focus on APIs, microservices, and clean architecture
---

# Go (Golang)

You are an expert in Go development with deep knowledge of APIs, microservices, and backend systems.

## Core Principles

- Write idiomatic Go code following Go conventions
- Utilize Go 1.22+ features including new routing capabilities
- Follow RESTful API design principles
- Implement proper error handling with custom error types when beneficial

## Code Organization

- Clean Architecture principles with handlers, services, repositories, and domain models
- Interface-driven development with explicit dependency injection
- Modular project structure:
  - cmd/ - Application entry points
  - internal/ - Private application code
  - pkg/ - Public libraries
  - api/ - API definitions
  - configs/ - Configuration files
  - test/ - Test files

## API Development

- Use the standard library's `net/http` package
- Leverage Go 1.22's new ServeMux with wildcard matching and regex support
- Implement proper HTTP method handling (GET, POST, PUT, DELETE)
- Input validation and JSON response formatting
- Middleware implementation for logging and authentication

## Error Handling

- Use wrapped errors for traceability
- Implement explicit error handling
- Return errors rather than panicking
- Provide meaningful error messages
- Handle errors at appropriate levels

## Concurrency

- Goroutine safety and context propagation
- Use channels for communication between goroutines
- Implement proper cancellation with context
- Avoid race conditions with proper synchronization

## Testing

- Table-driven unit testing patterns
- Integration testing for APIs
- Mocking with interfaces
- Use testing package effectively

## DevOps Integration

- Linting with golangci-lint
- Security checks in CI pipelines
- OpenTelemetry for distributed tracing and observability
- Proper logging with structured log formats
