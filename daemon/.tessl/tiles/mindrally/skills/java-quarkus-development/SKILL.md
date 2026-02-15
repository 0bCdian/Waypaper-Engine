---
name: java-quarkus-development
description: Java Quarkus development guidelines for building cloud-native applications with fast startup, minimal memory footprint, and GraalVM native builds
---

# Java Quarkus Development Best Practices

## Core Principles

- Write clean, efficient, and well-documented Java code using Quarkus best practices
- Focus on fast startup and minimal memory footprint via GraalVM native builds
- Leverage Quarkus extensions for common functionality
- Design for containerized and serverless deployments
- Follow SOLID principles and microservices architecture patterns

## Development Workflow

### Quarkus Dev Mode
- Use `quarkus dev` for rapid iteration with live reload
- Leverage continuous testing during development
- Use Dev UI for debugging and configuration inspection
- Take advantage of Dev Services for local development

## Configuration

### Type-Safe Configuration
- Use `@ConfigProperty` for type-safe configuration injection
- Group related configs with `@ConfigMapping` interfaces
- Validate configuration at startup
- Document configuration properties

### Profile-Based Configuration
- Use `%dev`, `%test`, `%prod` prefixes for environment-specific configs
- Override configs via environment variables in production
- Keep sensitive values out of source control
- Use `.env` files for local development

## Dependency Injection

### CDI Annotations
- Use `@Inject` for dependency injection
- Use `@Named` to qualify implementations
- Use `@Singleton`, `@ApplicationScoped`, `@RequestScoped` appropriately
- Prefer constructor injection for required dependencies

### Bean Discovery
- Understand Quarkus build-time bean discovery
- Use `@IfBuildProfile` for conditional beans
- Avoid reflection-heavy patterns for native builds

## REST API Development

### RESTEasy Reactive
- Use `@Path`, `@GET`, `@POST`, etc. for endpoint definitions
- Return proper HTTP status codes
- Use `@Valid` for input validation
- Implement exception mappers for consistent error responses

### Reactive Patterns
- Use Mutiny for reactive programming
- Leverage `Uni` and `Multi` for async operations
- Combine reactive with imperative code where appropriate

## Data Access

### Hibernate ORM with Panache
- Use Panache for simplified JPA patterns
- Leverage Active Record or Repository patterns
- Use `PanacheEntity` for entities with built-in operations
- Implement custom queries with `find` and `list` methods

### Database Operations
- Use Flyway or Liquibase for migrations
- Configure connection pooling with Agroal
- Use reactive database clients for non-blocking I/O

## Testing

### JUnit 5 Integration
- Use `@QuarkusTest` for integration tests
- Use `@QuarkusIntegrationTest` for native image tests
- Leverage test profiles for different configurations

### REST Endpoint Testing
- Use rest-assured for endpoint testing
- Test both success and error scenarios
- Verify response bodies and status codes
- Test authentication and authorization

## Performance Optimization

### Native Image Optimization
- Build native images with GraalVM for production
- Test native builds regularly during development
- Use `@RegisterForReflection` when needed
- Minimize reflection usage

### Memory and Startup
- Monitor memory usage in containers
- Optimize for serverless cold starts
- Use lazy initialization where appropriate

## Observability

### Health Checks
- Use MicroProfile Health for liveness and readiness probes
- Implement custom health checks for dependencies
- Configure Kubernetes probes based on health endpoints

### Metrics
- Use MicroProfile Metrics for application metrics
- Export metrics in Prometheus format
- Add custom metrics for business operations

### Distributed Tracing
- Use OpenTracing/OpenTelemetry integration
- Propagate trace context across services
- Configure sampling appropriately for production

## Security

- Use Quarkus Security extensions
- Implement authentication with OIDC or JWT
- Configure CORS for web clients
- Validate and sanitize all inputs
- Use HTTPS in production

## Containerization

- Use Quarkus container image extensions
- Build multi-stage Dockerfiles for native images
- Configure resource limits appropriately
- Use distroless or minimal base images
