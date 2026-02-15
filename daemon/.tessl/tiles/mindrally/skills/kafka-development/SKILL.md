---
name: kafka-development
description: Best practices and guidelines for Apache Kafka event streaming and distributed messaging
---

# Kafka Development

You are an expert in Apache Kafka event streaming and distributed messaging systems. Follow these best practices when building Kafka-based applications.

## Core Principles

- Kafka is a distributed event streaming platform for high-throughput, fault-tolerant messaging
- Unlike traditional pub/sub, Kafka uses a pull model - consumers pull messages from partitions
- Design for scalability, durability, and exactly-once semantics where needed
- Leave NO todos, placeholders, or missing pieces in the implementation

## Architecture Overview

### Core Components

- **Topics**: Categories/feeds for organizing messages
- **Partitions**: Ordered, immutable sequences within topics enabling parallelism
- **Producers**: Clients that publish messages to topics
- **Consumers**: Clients that read messages from topics
- **Consumer Groups**: Coordinate consumption across multiple consumers
- **Brokers**: Kafka servers that store data and serve clients

### Key Concepts

- Messages are appended to partitions in order
- Each message has an offset - a unique sequential ID within the partition
- Consumers maintain their own cursor (offset) and can read streams repeatedly
- Partitions are distributed across brokers for scalability

## Topic Design

### Partitioning Strategy

- Use partition keys to place related events in the same partition
- Messages with the same key always go to the same partition
- This ensures ordering for related events
- Choose keys carefully - uneven distribution causes hot partitions

### Partition Count

- More partitions = more parallelism but more overhead
- Consider: expected throughput, consumer count, broker resources
- Start with number of consumers you expect to run concurrently
- Partitions can be increased but not decreased

### Topic Configuration

- `retention.ms`: How long to keep messages (default 7 days)
- `retention.bytes`: Maximum size per partition
- `cleanup.policy`: delete (remove old) or compact (keep latest per key)
- `min.insync.replicas`: Minimum replicas that must acknowledge

## Producer Best Practices

### Reliability Settings

```
acks=all               # Wait for all replicas to acknowledge
retries=MAX_INT        # Retry on transient failures
enable.idempotence=true # Prevent duplicate messages on retry
```

### Performance Tuning

- `batch.size`: Accumulate messages before sending (default 16KB)
- `linger.ms`: Wait time for batching (0 = send immediately)
- `buffer.memory`: Total memory for buffering unsent messages
- `compression.type`: gzip, snappy, lz4, or zstd for bandwidth savings

### Error Handling

- Implement retry logic with exponential backoff
- Handle retriable vs non-retriable exceptions differently
- Log and alert on send failures
- Consider dead letter topics for messages that fail repeatedly

### Partitioner

- Default: hash of key determines partition (null key = round-robin)
- Custom partitioners for specific routing needs
- Ensure even distribution to avoid hot partitions

## Consumer Best Practices

### Offset Management

- Consumers track which messages they've processed via offsets
- `auto.offset.reset`: earliest (start from beginning) or latest (only new messages)
- Commit offsets after successful processing, not before
- Use `enable.auto.commit=false` for exactly-once semantics

### Consumer Groups

- Consumers in a group share partitions (each partition to one consumer)
- More consumers than partitions = some consumers idle
- Group rebalancing occurs when consumers join/leave
- Use `group.instance.id` for static membership to reduce rebalances

### Processing Patterns

- Process messages in order within a partition
- Handle out-of-order messages across partitions if needed
- Implement idempotent processing for at-least-once delivery
- Consider transactional processing for exactly-once

### Timeouts and Failures

- Implement processing timeout to isolate slow events
- When timeout occurs, set event aside and continue to next message
- Maintain overall system performance over processing every single event
- Use dead letter queues for messages failing all retries

## Error Handling and Retry

### Retry Strategy

- Allow multiple runtime retries per processing attempt
- Example: 3 runtime retries per redrive, maximum 5 redrives = 15 total retries
- Runtime retries typically cover 99% of failures
- After exhausting retries, route to dead letter queue

### Dead Letter Topics

- Create dedicated DLT for messages that can't be processed
- Include original topic, partition, offset, and error details
- Monitor DLT for patterns indicating systemic issues
- Implement manual or automated retry from DLT

## Schema Management

### Schema Registry

- Use Confluent Schema Registry for schema management
- Producers validate data against registered schemas during serialization
- Schema mismatches throw exceptions, preventing malformed data
- Provides common reference for producers and consumers

### Schema Evolution

- Design schemas for forward and backward compatibility
- Add optional fields with defaults for backward compatibility
- Avoid removing or renaming fields
- Use schema versioning and migration strategies

## Kafka Streams

### State Management

- Implement log compaction to maintain latest version of each key
- Periodically purge old data from state stores
- Monitor state store size and access patterns
- Use appropriate storage backends for your scale

### Windowing Operations

- Handle out-of-order events and skewed timestamps
- Use appropriate time extraction and watermarking techniques
- Configure grace periods for late-arriving data
- Choose window types based on use case (tumbling, hopping, sliding, session)

## Security

### Authentication

- Use SASL/SSL for client authentication
- Support SASL mechanisms: PLAIN, SCRAM, OAUTHBEARER, GSSAPI
- Enable SSL for encryption in transit
- Rotate credentials regularly

### Authorization

- Use Kafka ACLs for fine-grained access control
- Grant minimum necessary permissions per principal
- Separate read/write permissions by topic
- Audit access patterns regularly

## Monitoring and Observability

### Key Metrics

- **Producer**: record-send-rate, record-error-rate, batch-size-avg
- **Consumer**: records-consumed-rate, records-lag, commit-latency
- **Broker**: under-replicated-partitions, request-latency, disk-usage

### Lag Monitoring

- Consumer lag = last produced offset - last committed offset
- High lag indicates consumers can't keep up
- Alert on increasing lag trends
- Scale consumers or optimize processing

### Distributed Tracing

- Propagate trace context in message headers
- Use OpenTelemetry for end-to-end tracing
- Correlate producer and consumer spans
- Track message journey through the pipeline

## Testing

### Unit Testing

- Mock Kafka clients for isolated testing
- Test serialization/deserialization logic
- Verify partitioning logic
- Test error handling paths

### Integration Testing

- Use embedded Kafka or Testcontainers
- Test full producer-consumer flows
- Verify exactly-once semantics if used
- Test rebalancing scenarios

### Performance Testing

- Load test with production-like message rates
- Test consumer throughput and lag behavior
- Verify broker resource usage under load
- Test failure and recovery scenarios

## Common Patterns

### Event Sourcing

- Store all state changes as immutable events
- Rebuild state by replaying events
- Use log compaction for snapshots
- Enable time-travel debugging

### CQRS (Command Query Responsibility Segregation)

- Separate write (command) and read (query) models
- Use Kafka as the event store
- Build read-optimized projections from events
- Handle eventual consistency appropriately

### Saga Pattern

- Coordinate distributed transactions across services
- Each service publishes events for next step
- Implement compensating transactions for rollback
- Use correlation IDs to track saga instances

### Change Data Capture (CDC)

- Capture database changes as Kafka events
- Use Debezium or similar CDC tools
- Enable real-time data synchronization
- Build event-driven integrations
