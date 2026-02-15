---
name: observability-guidelines
description: Observability guidelines for distributed systems using OpenTelemetry, tracing, metrics, and structured logging
---

# Observability Guidelines

Apply these observability principles to ensure comprehensive visibility into distributed systems and microservices.

## Core Observability Principles

- Guide the development of idiomatic, maintainable, and high-performance code with built-in observability
- Enforce modular design and separation of concerns through Clean Architecture
- Promote test-driven development and robust observability from the start

## OpenTelemetry Integration

- Use OpenTelemetry for distributed tracing, metrics, and structured logging
- Start and propagate tracing spans across all service boundaries
- Use otel.Tracer for creating spans and otel.Meter for collecting metrics
- Export data to OpenTelemetry Collector, Jaeger, or Prometheus
- Configure appropriate sampling rates for production environments

## Distributed Tracing

- Trace all incoming requests and propagate context through internal calls
- Use middleware to instrument HTTP and gRPC endpoints automatically
- Include trace context in all downstream service calls
- Create child spans for significant operations within a service
- Add relevant attributes to spans for debugging and analysis

## Metrics Collection

Monitor these key metrics across all services:

- **Request latency**: Track p50, p90, p95, and p99 percentiles
- **Throughput**: Measure requests per second by endpoint
- **Error rate**: Track 4xx and 5xx responses separately
- **Resource usage**: Monitor CPU, memory, disk, and network utilization
- **Custom business metrics**: Track domain-specific KPIs

## Structured Logging

- Include unique request IDs and trace context in all logs for correlation
- Use structured logging formats (JSON) for machine parseability
- Include relevant context: timestamp, service name, trace ID, span ID
- Log at appropriate levels: DEBUG, INFO, WARN, ERROR
- Avoid logging sensitive information (PII, credentials)

## Architecture Patterns

- Apply Clean Architecture with handlers, services, repositories, and domain models
- Use domain-driven design principles for clear boundaries
- Prioritize interface-driven development with explicit dependency injection
- Prefer composition over inheritance; favor small, purpose-specific interfaces

## Correlation and Context

- Propagate context through the entire request lifecycle
- Use correlation IDs for request tracking across services
- Include service version and deployment information in telemetry
- Tag traces with relevant business context for filtering
- Enable trace-to-log and log-to-trace correlation

## Alerting and Dashboards

- Create dashboards for service health and business metrics
- Set up alerts based on SLOs and error budgets
- Use anomaly detection for proactive issue identification
- Document runbooks for common alert scenarios
- Review and tune alerts regularly to reduce noise

## Instrumentation Best Practices

- Instrument at service boundaries (entry/exit points)
- Add custom spans for database operations and external calls
- Include relevant attributes (user ID, request type, etc.)
- Avoid over-instrumentation that creates noise
- Use semantic conventions for consistent attribute naming

## Production Considerations

- Configure appropriate sampling rates to balance visibility and cost
- Use head-based sampling for consistent trace capture
- Implement tail-based sampling for capturing errors
- Set retention policies based on debugging needs
- Monitor observability infrastructure health
