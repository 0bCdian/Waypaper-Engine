---
name: websocket-development
description: Best practices and guidelines for building real-time applications with WebSocket communication
---

# WebSocket Development

You are an expert in WebSocket development and real-time communication systems. Follow these best practices when building WebSocket-based applications.

## Core Principles

- Think through the implementation step-by-step before writing code
- Follow the user's requirements carefully and to the letter
- Prioritize security, scalability, and maintainability throughout
- Leave NO todos, placeholders, or missing pieces in the implementation

## Connection Management

### Establishing Connections

- Always use the `wss://` protocol with SSL/TLS encryption for production environments
- This ensures data transmitted over the connection is encrypted and secure from eavesdropping or tampering
- Implement proper handshake validation before accepting connections
- Set appropriate connection timeouts to prevent resource exhaustion

### Connection Lifecycle

- Implement heartbeat/ping-pong mechanisms to detect stale connections
- Use reconnection logic with exponential backoff for dropped connections
- Maintain connection state to handle disconnection scenarios gracefully
- Clean up resources properly when connections close

## Message Handling

### Message Design

- Use structured message formats (JSON with type/payload pattern)
- Include message IDs for request-response correlation
- Implement message versioning for backward compatibility
- Keep message payloads small to reduce latency

### Error Handling

- Always include error handling logic for WebSocket connections
- Manage potential disconnections or message failures gracefully
- Implement dead letter handling for unprocessable messages
- Log errors with sufficient context for debugging

## Scalability Patterns

### Horizontal Scaling

- Use a message broker (Redis Pub/Sub, RabbitMQ) for cross-server communication
- Implement sticky sessions or connection affinity when needed
- Design stateless handlers where possible
- Consider using a dedicated WebSocket gateway service

### Performance Optimization

- Buffer messages during brief disconnections
- Implement message batching for high-frequency updates
- Use binary protocols (MessagePack, Protocol Buffers) for bandwidth-sensitive applications
- Monitor connection counts and message throughput

## Security Best Practices

### Authentication

- Authenticate connections during the handshake phase
- Use token-based authentication (JWT) with proper expiration
- Validate tokens on both connection and periodic intervals
- Implement rate limiting per connection and per user

### Authorization

- Validate permissions for each message type/channel
- Implement channel-based access control for pub/sub patterns
- Never trust client-provided data without validation
- Sanitize all incoming message payloads

## Framework-Specific Guidelines

### Node.js Native WebSocket (v21+)

- Utilize Node.js's built-in WebSocket client for real-time communication to reduce dependencies
- The built-in client simplifies real-time communication and ensures better interoperability
- For servers, use established libraries like `ws` or framework-specific solutions

### Bun Runtime

- Prefer Bun's native capabilities over third-party alternatives
- Use `Bun.serve()` with WebSocket support instead of separate WebSocket libraries
- Leverage Bun's built-in stream handling and fetch implementation

### Browser Clients

- Implement graceful degradation for older browsers
- Use the standard WebSocket API for broad compatibility
- Handle visibility changes to manage connection state
- Implement offline detection and queuing

## Testing Strategies

### Unit Testing

- Mock WebSocket connections for isolated testing
- Test message serialization/deserialization independently
- Verify error handling paths

### Integration Testing

- Test full connection lifecycle scenarios
- Verify reconnection behavior under various failure modes
- Load test with realistic connection counts and message rates

## Monitoring and Observability

- Track connection count metrics
- Monitor message latency and throughput
- Alert on connection error rates
- Log connection lifecycle events for debugging

## Common Patterns

### Pub/Sub Pattern

- Implement channel subscription management
- Use efficient data structures for subscriber lookup
- Handle subscription cleanup on disconnect

### Request/Response Pattern

- Correlate requests and responses with unique IDs
- Implement timeout handling for pending requests
- Consider using acknowledgment messages for reliability

### Broadcast Pattern

- Optimize for one-to-many message delivery
- Consider message deduplication strategies
- Implement backpressure for slow consumers
