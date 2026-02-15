---
name: go-api-development
description: Go API development guidelines using the standard library (1.22+) with best practices for RESTful API design, error handling, and security
---

# Go API Development with Standard Library

## Core Principles

- Always use the latest stable version of Go (1.22 or newer) and be familiar with RESTful API design principles, net/http package, and the new ServeMux introduced in Go 1.22
- Follow the user's requirements carefully and to the letter
- First think step-by-step - describe your plan for the API structure, endpoints, and data flow in pseudocode, written out in great detail
- Write correct, up-to-date, bug-free, fully functional, secure, and efficient Go code for APIs
- Leave NO todos, placeholders, or missing pieces in the API implementation
- Always prioritize security, scalability, and maintainability in your API designs

## API Development Guidelines

### Routing and HTTP Handling

- Use the new `http.ServeMux` introduced in Go 1.22 for routing
- Implement proper HTTP method handling (GET, POST, PUT, DELETE, PATCH)
- Use appropriate HTTP status codes for responses
- Implement proper content-type handling for requests and responses

### Error Handling

- Implement proper error handling, including custom error types when beneficial
- Return appropriate HTTP status codes with error responses
- Use structured error responses in JSON format
- Log errors appropriately for debugging and monitoring

### Input Validation

- Implement input validation for API endpoints
- Validate request bodies, query parameters, and path parameters
- Return clear validation error messages to clients
- Sanitize inputs to prevent injection attacks

### JSON Handling

- Use `encoding/json` for JSON serialization/deserialization
- Implement proper struct tags for JSON field mapping
- Handle JSON parsing errors gracefully
- Use appropriate JSON formatting for responses

### Concurrency

- Leverage Go's built-in concurrency features when appropriate for API performance
- Use goroutines for concurrent operations where beneficial
- Implement proper synchronization for shared state
- Use context for request cancellation and timeouts

### Middleware

- Implement middleware for cross-cutting concerns (logging, authentication, rate limiting)
- Use middleware chaining for composable request processing
- Implement CORS handling where needed
- Add request/response logging middleware

### Security

- Implement authentication and authorization where appropriate
- Use HTTPS in production
- Implement rate limiting to prevent abuse
- Validate and sanitize all user inputs
- Use secure defaults for cookies and sessions

### Logging

- Use standard library logging with structured output
- Log appropriate information for debugging and monitoring
- Avoid logging sensitive information
- Use log levels appropriately

### Testing

- Write unit tests for handlers and business logic
- Implement integration tests for API endpoints
- Use table-driven tests where appropriate
- Mock external dependencies in tests
