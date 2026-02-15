---
name: rabbitmq-development
description: Best practices and guidelines for RabbitMQ message queue development with AMQP protocol
---

# RabbitMQ Development

You are an expert in RabbitMQ and AMQP (Advanced Message Queuing Protocol) development. Follow these best practices when building message queue-based applications.

## Core Principles

- RabbitMQ is a message broker that receives messages from publishers and routes them to consumers
- AMQP 0-9-1 is the most commonly used protocol - an application layer protocol transmitting data in binary format
- Design for reliability, scalability, and fault tolerance
- Leave NO todos, placeholders, or missing pieces in the implementation

## Architecture Components

### Exchanges

- **Direct Exchange**: Routes based on exact routing key match - use for unicast routing
- **Fanout Exchange**: Routes to all bound queues regardless of routing key - use for broadcast
- **Topic Exchange**: Routes based on wildcard pattern matching - use for multicast routing
- **Headers Exchange**: Routes based on message header attributes - use for complex routing logic

### Queues

- Queues store messages until consumed
- Can be durable (survives broker restart) or transient (in-memory only)
- Metadata of durable queues is stored on disk
- Metadata of transient queues is stored in memory when possible

### Bindings

- Connect exchanges to queues with routing rules
- Binding keys determine which messages reach which queues
- Multiple bindings can connect the same exchange to multiple queues

## Queue Management Best Practices

### Queue Size

- Keep queue sizes small - large queues put heavy load on RAM usage
- RabbitMQ flushes messages to disk when RAM is constrained, impacting performance
- Monitor queue depth and implement backpressure mechanisms
- Use TTL (Time-To-Live) to automatically remove old messages

### Queue Types

#### Classic Queues

- Traditional RabbitMQ queue implementation
- Good for most use cases
- Supports all features (lazy queues, priorities, etc.)

#### Quorum Queues (Recommended)

- Introduced in RabbitMQ 3.8
- Replicated queue type for high availability and data safety
- Declare with `x-queue-type: quorum`
- Use for queues requiring durability and fault tolerance
- Cannot be set via policy - must be declared by client

### Performance Optimization

- Use transient messages for fastest throughput when durability isn't required
- Persistent messages are written to disk immediately, affecting throughput
- Queues are single-threaded - one queue handles up to ~50,000 messages
- Use multiple queues for better throughput on multi-core systems
- Have as many queues as cores on the underlying nodes

## Connection and Channel Management

### Connections

- Each connection uses approximately 100 KB of RAM (more with TLS)
- Thousands of connections can burden the server significantly
- Implement connection pooling in your applications
- Reuse connections where possible

### Channels

- Channels are lightweight connections multiplexing a single TCP connection
- Publishing and consuming happens over channels
- Create channels per thread/operation, not per message
- Close channels when no longer needed to free resources

## Prefetch and Consumer Configuration

### Prefetch (QoS)

- Prefetch defines how many unacknowledged messages a consumer receives at once
- Setting prefetch optimizes consumer throughput
- Low prefetch (1-10): Fair distribution, good for slow consumers
- High prefetch (100+): Better throughput, risk of uneven distribution
- Start with a moderate value (50-100) and tune based on metrics

### Acknowledgments

- **Auto-ack**: Higher throughput, least guarantees on failures
- **Manual-ack**: Lower throughput, better reliability
- Consider manual acknowledgment mode first as a rule of thumb
- Acknowledge promptly after processing to release server resources

## Message Handling

### Message Properties

- Set `delivery_mode=2` for persistent messages (survives broker restart)
- Use `content_type` to indicate payload format
- Include `correlation_id` for request/response patterns
- Set `expiration` for time-sensitive messages

### Publishing Best Practices

- Use publisher confirms for reliable publishing
- Handle returned messages (mandatory flag) appropriately
- Batch messages when possible for better throughput
- Consider message size - large messages impact performance

## Error Handling

### Dead Letter Exchanges

- Configure DLX for handling failed messages
- Messages routed to DLX when: rejected with requeue=false, TTL expires, queue length exceeded
- Process dead-lettered messages separately for analysis and retry

### Retry Queues Pattern

- Don't requeue failed messages to the same queue indefinitely
- Risk of self-inflicted DoS attack with continuous retry loops
- Implement retry queues with increasing delays
- Forward problematic messages to a "timeout" queue
- Example delays: 1s, 5s, 30s, then dead letter

### Circuit Breaker

- Implement circuit breaker pattern for downstream failures
- Prevent queue buildup when consumers can't process messages
- Use exponential backoff for reconnection attempts

## High Availability

### Clustering

- Deploy RabbitMQ in a cluster for high availability
- Use quorum queues for replicated, durable queues
- Configure appropriate number of replicas

### Mirroring (Classic Queues)

- Use `ha-mode` policy for classic queue mirroring
- Prefer quorum queues over mirrored classic queues for new deployments

## Security

### Authentication

- Use strong passwords and rotate regularly
- Consider LDAP or OAuth2 integration for enterprise deployments
- Enable TLS for encrypted connections
- Use separate credentials per application/service

### Authorization

- Implement vhost-based isolation for multi-tenant scenarios
- Grant minimum necessary permissions (configure, write, read)
- Use permission patterns to restrict access to specific resources

## Monitoring and Observability

### Key Metrics

- Queue depth (messages ready, messages unacknowledged)
- Message rates (publish, deliver, acknowledge)
- Connection and channel counts
- Memory and disk usage
- Consumer utilization

### Management Plugin

- Enable the management plugin for monitoring UI
- Use HTTP API for programmatic monitoring
- Export metrics to Prometheus/Grafana

### Alerts

- Alert on queue depth exceeding thresholds
- Monitor memory and disk alarms
- Track consumer disconnections
- Watch for message rate anomalies

## Testing

### Unit Testing

- Mock RabbitMQ client for isolated testing
- Test message serialization/deserialization
- Verify exchange and queue declarations

### Integration Testing

- Use containerized RabbitMQ for tests
- Test failure scenarios (connection loss, broker restart)
- Verify message acknowledgment behavior
- Load test with realistic message rates

## Common Patterns

### Work Queues (Task Distribution)

- Multiple consumers on single queue for load distribution
- Use prefetch to ensure fair distribution
- Acknowledge after task completion

### Publish/Subscribe

- Use fanout exchange for broadcasting
- Each subscriber gets its own queue bound to the exchange
- Consider topic exchange for filtered subscriptions

### RPC (Request/Response)

- Use correlation_id to match requests and responses
- Create exclusive reply queue per client
- Implement timeouts for pending requests

### Event Sourcing

- Use exchanges for event distribution
- Multiple services can independently consume events
- Maintain event ordering within partitions
