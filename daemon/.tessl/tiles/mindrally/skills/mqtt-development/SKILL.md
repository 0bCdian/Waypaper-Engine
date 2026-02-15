---
name: mqtt-development
description: Best practices and guidelines for MQTT messaging in IoT and real-time communication systems
---

# MQTT Development

You are an expert in MQTT (Message Queuing Telemetry Transport) protocol development for IoT and real-time messaging systems. Follow these best practices when building MQTT-based applications.

## Core Principles

- MQTT is designed as an extremely lightweight publish/subscribe messaging transport
- Ideal for connecting remote devices with small code footprint and minimal network bandwidth
- MQTT requires up to 80% less network bandwidth than HTTP for transmitting the same amount of data
- A minimal MQTT control message can be as little as two data bytes

## Architecture Overview

### Components

- **Message Broker**: Server that receives messages from publishing clients and routes them to destination clients
- **Clients**: Any device (microcontroller to server) running an MQTT library connected to a broker
- **Topics**: Hierarchical strings used to filter and route messages
- **Subscriptions**: Client registrations for specific topic patterns

## Topic Design Best Practices

### Topic Structure

- Use hierarchical topic structures with forward slashes as level separators
- Maximum of seven forward slashes (/) in topic names for AWS IoT Core compatibility
- Do NOT prefix topics with a forward slash - it counts towards topic levels and creates confusion
- Use meaningful, descriptive topic segments

### Topic Naming Conventions

```
{organization}/{location}/{device-type}/{device-id}/{data-type}
```

Example: `acme/building-1/sensor/temp-001/temperature`

### Wildcard Usage

- **Single-level wildcard (+)**: Matches one topic level - prefer for device subscriptions
- **Multi-level wildcard (#)**: Matches all remaining levels - use sparingly
- Never allow a device to subscribe to all topics using `#`
- Reserve multi-level wildcards for server-side rules engines
- Use single-level wildcards (+) for device subscriptions to prevent unintended consequences

## Quality of Service (QoS) Levels

### QoS 0 - At Most Once

- Fire and forget - no acknowledgment
- Fastest but least reliable
- Use for: Sensor data where occasional loss is acceptable, high-frequency telemetry

### QoS 1 - At Least Once

- Guaranteed delivery, may have duplicates
- Balance of reliability and performance
- Use for: Important notifications, commands that can be safely repeated

### QoS 2 - Exactly Once

- Guaranteed single delivery using four-way handshake
- Highest overhead but most reliable
- Use for: Financial transactions, critical commands, state changes

### Choosing QoS

- Match QoS to your reliability requirements
- Consider bandwidth constraints - higher QoS means more overhead
- Publisher and subscriber QoS are independent - broker delivers at lower of the two

## Session Management

### Clean Sessions

- `cleanSession=true`: No session state preserved, suitable for transient clients
- `cleanSession=false`: Broker stores subscriptions and queued messages for offline clients

### Persistent Sessions

- Enable for devices with intermittent connectivity
- Broker stores undelivered messages (based on QoS) for later delivery
- Set appropriate session expiry intervals
- Consider message queue limits on the broker

### Keep-Alive

- Configure keep-alive interval based on network conditions
- Broker uses keep-alive to detect dead connections
- Shorter intervals = faster detection, more overhead
- Typical values: 30-60 seconds for stable networks, 10-15 for mobile

## Last Will and Testament (LWT)

- Configure LWT message for each client
- Broker publishes LWT when client disconnects unexpectedly
- Use for: Device status updates, alerts, cleanup triggers
- LWT topic typically: `{base-topic}/status` with payload `offline`

## Security Best Practices

### Transport Security

- MQTT sends credentials in plain text by default
- Always use TLS to encrypt connections in production
- Default unencrypted port: 1883
- Encrypted port: 8883
- Verify broker certificates to prevent MITM attacks

### Authentication

- Use strong client credentials (username/password or certificates)
- Implement OAuth, TLS 1.3, or customer-managed certificates where supported
- Rotate credentials regularly
- Consider client certificate authentication for high-security scenarios

### Authorization

- Implement topic-level access control
- Clients should only access topics they need
- Use ACLs (Access Control Lists) on the broker
- Separate read and write permissions per topic

## Message Design

### Payload Format

- Use efficient serialization (JSON for readability, binary for efficiency)
- Keep payloads small - MQTT is designed for constrained environments
- Include timestamps in messages for time-series data
- Consider schema versioning for payload format changes

### Message Properties

- Use retained messages for current state (last known value)
- Set appropriate message expiry for time-sensitive data
- Use user properties for metadata without polluting payload

## Client Implementation

### Connection Handling

- Implement automatic reconnection with exponential backoff
- Handle connection loss gracefully
- Queue messages during disconnection for later delivery
- Use connection pooling for multi-threaded applications

### Subscription Management

- Subscribe to specific topics, avoid broad wildcards
- Unsubscribe when no longer needed
- Handle subscription acknowledgment failures
- Resubscribe after reconnection if using clean sessions

### Publishing Best Practices

- Validate messages before publishing
- Handle publish failures appropriately
- Use batching for high-frequency publishing where supported
- Consider message ordering requirements

## Broker Configuration

### Scalability

- Configure appropriate connection limits
- Set message queue sizes based on expected load
- Implement clustering for high availability
- Use load balancers for horizontal scaling

### Monitoring

- Track connection counts and rates
- Monitor message throughput and latency
- Alert on queue depth and memory usage
- Log authentication failures

## Testing

### Unit Testing

- Mock MQTT client for isolated testing
- Test message serialization/deserialization
- Verify QoS handling logic

### Integration Testing

- Test with real broker in test environment
- Verify reconnection scenarios
- Test LWT functionality
- Load test with realistic device counts

## Common Patterns

### Request/Response

- Use correlated topics: `request/{id}` and `response/{id}`
- Include correlation ID in message
- Implement timeouts for responses

### Device Shadow/Twin

- Maintain desired and reported state
- Use separate topics for state updates
- Handle state synchronization on reconnection

### Command and Control

- Use dedicated command topics per device
- Implement command acknowledgment
- Handle command queuing for offline devices
