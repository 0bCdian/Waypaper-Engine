---
name: logging-best-practices
description: Logging best practices for applications and services including structured logging, log levels, and log management strategies
---

# Logging Best Practices

Apply these logging principles to ensure effective debugging, monitoring, and audit capabilities across applications and services.

## Structured Logging

- Use structured logging formats (JSON) for all log output
- Include consistent fields across all log entries
- Make logs machine-parseable while remaining human-readable
- Use a logging library that supports structured output natively
- Avoid string concatenation for log messages; use structured fields

## Standard Log Fields

Include these fields in every log entry:

- **timestamp**: ISO 8601 format with timezone
- **level**: Log severity (DEBUG, INFO, WARN, ERROR, FATAL)
- **message**: Human-readable description of the event
- **service**: Name of the service or application
- **version**: Application version or build identifier
- **trace_id**: Distributed tracing correlation ID
- **span_id**: Current span identifier
- **request_id**: Unique identifier for the request

## Log Levels

Use appropriate log levels consistently:

- **DEBUG**: Detailed diagnostic information for development
- **INFO**: Normal operational events and state changes
- **WARN**: Unexpected situations that are handled gracefully
- **ERROR**: Failures that affect current operation but not the service
- **FATAL**: Critical failures requiring immediate attention

## Context Propagation

- Include request context in all log entries within a request lifecycle
- Propagate trace IDs across service boundaries
- Add user context (anonymized) for user-initiated actions
- Include relevant business context for domain events
- Use MDC (Mapped Diagnostic Context) or equivalent for context management

## Security and Privacy

- Never log sensitive information (passwords, tokens, PII)
- Mask or redact sensitive data when it must be referenced
- Implement log access controls appropriate to data sensitivity
- Consider data retention policies and compliance requirements
- Audit log access for sensitive systems

## Performance Considerations

- Use asynchronous logging to avoid blocking application threads
- Implement log sampling for high-volume debug logs in production
- Buffer logs appropriately to balance latency and throughput
- Monitor logging infrastructure for bottlenecks
- Set appropriate log levels per environment

## Log Aggregation

- Centralize logs from all services into a single platform
- Use consistent formatting across all services
- Implement log rotation and retention policies
- Enable full-text search and filtering capabilities
- Set up log-based alerts for critical patterns

## Error Logging

- Include full error context: message, code, stack trace
- Log the chain of errors in wrapped/nested exceptions
- Include relevant request and state information
- Avoid duplicate error logging across layers
- Log error recovery actions and outcomes

## Best Practices

- Log at service boundaries (entry and exit points)
- Include timing information for performance analysis
- Log configuration changes and deployments
- Create actionable log messages that aid debugging
- Review and clean up logging regularly to reduce noise

## Log Message Guidelines

- Write clear, descriptive messages
- Include relevant identifiers (user ID, order ID, etc.)
- Avoid generic messages like "Error occurred"
- Use consistent terminology across the application
- Include enough context to understand the event without additional lookups

## Environment-Specific Configuration

- **Development**: DEBUG level, console output, verbose formatting
- **Staging**: INFO level, structured JSON, full context
- **Production**: INFO/WARN level, structured JSON, sampling for DEBUG
