---
name: grpc-development
description: Best practices and guidelines for building high-performance services with gRPC and Protocol Buffers
---

# gRPC Development

You are an expert in gRPC and Protocol Buffers development. Follow these best practices when building gRPC-based services and APIs.

## Core Principles

- gRPC uses Protocol Buffers as both its Interface Definition Language (IDL) and message interchange format
- Design services around the idea of defining methods that can be called remotely with their parameters and return types
- Prioritize type safety, performance, and backward compatibility
- Leave NO todos, placeholders, or missing pieces in the implementation

## Protocol Buffer Best Practices

### File Organization (1-1-1 Pattern)

- Structure definitions with one top-level entity (message, enum, or extension) per .proto file
- Correspond each .proto file to a single build rule
- This promotes small, modular proto definitions
- Benefits include simplified refactoring, improved build times, and smaller binary sizes

### Message Design

- Use structured messages for extensibility - Protocol Buffers supports adding fields without breaking existing clients
- Be careful to use structs in places you may want to add fields later
- Don't re-use messages across RPCs - APIs may change over time, avoid coupling separate RPC calls tightly together
- Fields should always be independent of each other - don't have one field influence the semantic meaning of another

### Field Guidelines

- Use descriptive field names with underscore_separated_names
- Reserve field numbers for deleted fields to prevent future conflicts
- Use `optional` for fields that may not always be present
- Consider using `oneof` when users need to choose between mutually exclusive options

### Enum Best Practices

- Ensure the first value is always 0
- Use an "UNSPECIFIED" default value (e.g., `STATUS_UNSPECIFIED = 0`)
- Use prefixes to avoid naming collisions (e.g., `ORDER_STATUS_CREATED` vs `STATUS_PENDING`)
- Reserve enum values that are removed to prevent accidental reuse

## Style Guidelines

- Keep line length to 80 characters
- Prefer double quotes for strings
- Package names should be in lowercase
- Use CamelCase (with initial capital) for message names
- Use underscore_separated_names for field names
- Use CamelCase for service and RPC method names

## Service Design

### RPC Patterns

- **Unary RPC**: Client sends single request, server responds with single response
- **Server Streaming**: Client sends request, server responds with stream of messages
- **Client Streaming**: Client sends stream of messages, server responds with single response
- **Bidirectional Streaming**: Both sides send streams of messages

### API Design

- Design clear, intuitive service interfaces
- Group related methods in the same service
- Use meaningful method names that describe the action
- Document each RPC with comments describing behavior, parameters, and return values

## Performance Optimization

### Channel Management

- Reuse channels when working with gRPC
- Creating a gRPC channel is costly as it creates a new HTTP/2 connection
- Implement connection pooling for high-throughput scenarios
- Configure keepalive settings appropriately

### Message Optimization

- Keep messages reasonably sized - large messages impact performance
- Consider streaming for large data transfers
- Use compression for bandwidth-constrained environments
- Avoid deeply nested message structures

## Error Handling

### Status Codes

- Use appropriate gRPC status codes (OK, INVALID_ARGUMENT, NOT_FOUND, etc.)
- Include meaningful error messages in status details
- Use rich error details for complex error scenarios
- Document expected error conditions in service definitions

### Retry Logic

- Implement retry with exponential backoff for transient failures
- Use deadlines/timeouts for all RPC calls
- Handle UNAVAILABLE and RESOURCE_EXHAUSTED with retries
- Don't retry non-idempotent operations blindly

## Security

### Authentication

- Use TLS for transport security in production
- Implement per-RPC authentication using metadata/headers
- Support multiple authentication mechanisms (JWT, OAuth2, mTLS)
- Validate credentials on every request

### Authorization

- Implement method-level access control
- Use interceptors for centralized authorization logic
- Validate all input data regardless of authentication status
- Follow the principle of least privilege

## Interceptors and Middleware

### Server Interceptors

- Use interceptors for cross-cutting concerns (logging, auth, metrics)
- Order interceptors carefully - execution order matters
- Keep interceptors focused on single responsibilities
- Handle errors gracefully within interceptors

### Client Interceptors

- Add metadata (headers) for tracing and authentication
- Implement request/response logging
- Add automatic retry logic
- Collect client-side metrics

## Testing

### Unit Testing

- Mock gRPC services for isolated testing
- Test message serialization/deserialization
- Verify error handling paths
- Test interceptor logic independently

### Integration Testing

- Test with real gRPC connections where possible
- Verify streaming behavior end-to-end
- Test timeout and cancellation scenarios
- Load test with realistic traffic patterns

## Observability

### Distributed Tracing

- Use OpenTelemetry for distributed tracing across service boundaries
- Propagate trace context in metadata
- Instrument both client and server sides
- Start spans for each RPC call

### Metrics

- Track RPC latency histograms
- Monitor error rates by method and status code
- Count active connections and streams
- Alert on anomalies and SLA violations

### Logging

- Use structured logging with consistent fields
- Log RPC method, duration, and status
- Include trace IDs for correlation
- Avoid logging sensitive data

## Language-Specific Guidelines

### Go

- Use the official `google.golang.org/grpc` package
- Implement services as interface types
- Use context for cancellation and deadlines
- Leverage code generation with `protoc-gen-go-grpc`

### Python

- Use `grpcio` and `grpcio-tools` packages
- Implement async services with `grpcio-aio` for better concurrency
- Use type hints with generated stubs
- Handle blocking calls appropriately in async contexts

### Node.js/TypeScript

- Use `@grpc/grpc-js` (pure JavaScript implementation)
- Consider using `nice-grpc` for better TypeScript support
- Leverage async/await patterns
- Use static codegen for type safety
