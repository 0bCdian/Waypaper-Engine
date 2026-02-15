---
name: general-best-practices
description: General software development best practices covering code quality, testing, security, performance, and maintainability across technology stacks
---

# General Best Practices

A comprehensive collection of software development best practices applicable across various technology stacks and project types.

## Code Quality

### Readability and Maintainability

Write short, focused functions with a single responsibility.

Use clear, descriptive names for variables, functions, and classes.

Avoid deep nesting; prefer early returns and guard clauses.

Keep functions and methods to a reasonable length (typically under 30 lines).

### Error Handling

Always handle errors explicitly rather than silently ignoring them.

Use wrapped errors for traceability and context.

Provide meaningful error messages that help with debugging.

Fail fast and fail loudly during development.

### Code Organization

Organize code into logical modules and packages.

Separate concerns: keep business logic separate from infrastructure code.

Use consistent file and folder naming conventions.

Follow the principle of least surprise in API design.

## Architecture

### Clean Architecture Principles

Structure code into distinct layers:

- **Presentation/Handlers**: Handle external requests and responses
- **Application/Services**: Orchestrate business operations
- **Domain**: Core business logic and entities
- **Infrastructure**: External systems, databases, and frameworks

### Design Principles

Prefer composition over inheritance.

Program to interfaces, not implementations.

Use dependency injection for testability and flexibility.

Design for change: isolate business logic and minimize framework lock-in.

Apply SOLID principles where appropriate.

## Testing

### Unit Testing

Write tests that are fast, isolated, and repeatable.

Use table-driven tests for testing multiple scenarios.

Mock external dependencies cleanly.

Aim for high test coverage of business-critical code.

### Integration Testing

Test interactions between components and external systems.

Use separate test configurations and databases.

Clean up test data after each test run.

### Test Organization

Separate fast unit tests from slower integration tests.

Run fast tests frequently during development.

Include tests in CI/CD pipelines.

## Security

### Input Validation

Validate all inputs at service boundaries.

Never trust user input; sanitize and validate everything.

Use parameterized queries to prevent SQL injection.

### Authentication and Authorization

Use secure defaults for tokens and sessions.

Implement proper access control at every layer.

Store secrets securely; never commit them to version control.

### Network Security

Use HTTPS for all communications.

Implement rate limiting to prevent abuse.

Use circuit breakers for external service calls.

## Performance

### Optimization Principles

Profile before optimizing; avoid premature optimization.

Measure and benchmark regularly.

Focus on hot paths and frequently executed code.

### Resource Management

Minimize memory allocations in critical paths.

Use connection pooling for database and network connections.

Implement proper resource cleanup and disposal.

### Caching

Cache expensive computations and frequently accessed data.

Use appropriate cache invalidation strategies.

Consider cache consistency and freshness requirements.

## Observability

### Logging

Use structured logging (JSON format for production).

Include relevant context: request IDs, user IDs, timestamps.

Log at appropriate levels: DEBUG, INFO, WARN, ERROR.

Avoid logging sensitive information.

### Metrics

Track key metrics: latency, throughput, error rates.

Set up alerts for anomalies and threshold violations.

Use dashboards for visibility into system health.

### Tracing

Implement distributed tracing for microservices.

Propagate trace context across service boundaries.

Record important attributes in spans for debugging.

## Documentation

### Code Documentation

Document public APIs with clear descriptions.

Explain the "why" not just the "what".

Keep documentation close to the code it describes.

Update documentation when code changes.

### Project Documentation

Maintain a clear README with setup instructions.

Document architecture decisions (ADRs).

Provide contribution guidelines for team members.

## Version Control

### Commit Practices

Write clear, concise commit messages.

Make atomic commits that represent a single logical change.

Keep commits small and focused.

### Branch Strategy

Use feature branches for new development.

Keep the main branch stable and deployable.

Review code before merging to main.

## Tooling and Automation

### Continuous Integration

Run tests automatically on every commit.

Enforce code formatting and linting.

Include security scanning in the pipeline.

### Development Environment

Use consistent development environments across the team.

Document setup steps and prerequisites.

Automate common development tasks.
