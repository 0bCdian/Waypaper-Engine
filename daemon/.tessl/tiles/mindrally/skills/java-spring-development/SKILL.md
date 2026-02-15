---
name: java-spring-development
description: Java Spring Boot development guidelines with best practices for building robust, secure, and maintainable enterprise applications
---

# Java Spring Development Best Practices

## Core Principles

- Write clean, efficient, and well-documented Java code with accurate Spring Boot examples
- Use Spring Boot 3.x with Java 17+ features (records, sealed classes, pattern matching)
- Prefer constructor injection over field injection for better testability
- Follow SOLID principles and RESTful API design patterns
- Design for microservices architecture suitability

## Project Structure

Organize code using the standard layered pattern:

```
project/
├── controllers/     # REST controllers
├── services/        # Business logic
├── repositories/    # Data access layer
├── models/          # Domain entities and DTOs
└── configurations/  # Spring configurations
```

## Dependency Injection

- Use constructor injection for required dependencies
- Leverage `@RequiredArgsConstructor` with Lombok for cleaner code
- Keep constructors simple and avoid logic in them
- Use `@Qualifier` when multiple implementations exist

## REST API Design

- Use appropriate HTTP methods (GET, POST, PUT, DELETE, PATCH)
- Return proper HTTP status codes
- Implement consistent error response format
- Use DTOs to control API contract
- Version APIs when needed

## Data Access

### Spring Data JPA
- Define proper entity relationships (@OneToMany, @ManyToOne, etc.)
- Use lazy loading appropriately to avoid N+1 queries
- Implement pagination for large result sets
- Use query methods and @Query for custom queries

### Database Migrations
- Use Flyway or Liquibase for schema migrations
- Version migration scripts properly
- Never modify existing migrations
- Test migrations in development before production

## Security

### Spring Security
- Implement authentication and authorization properly
- Use BCrypt for password encoding
- Configure CORS appropriately
- Protect endpoints based on roles/permissions
- Use HTTPS in production

### Secure Coding
- Validate all user inputs
- Sanitize data to prevent injection attacks
- Avoid exposing sensitive information in responses
- Use parameterized queries

## Testing

### Unit Testing
- Use JUnit 5 for unit tests
- Mock dependencies with Mockito
- Test business logic thoroughly
- Follow Given-When-Then pattern

### Integration Testing
- Use @SpringBootTest for integration tests
- Use MockMvc for web layer testing
- Test database operations with test containers
- Test security configurations

## Performance

### Caching
- Use Spring Cache abstraction
- Configure appropriate cache providers (Redis, Caffeine)
- Set proper TTL for cached data
- Implement cache eviction strategies

### Async Processing
- Use @Async for non-blocking operations
- Configure thread pools appropriately
- Handle exceptions in async methods
- Consider using reactive patterns for high concurrency

## Logging and Monitoring

### Logging
- Use SLF4J with Logback
- Log at appropriate levels
- Include correlation IDs for tracing
- Avoid logging sensitive data

### Monitoring
- Use Spring Boot Actuator for health and metrics
- Export metrics to monitoring systems
- Set up proper health checks
- Monitor application performance

## API Documentation

- Use Springdoc OpenAPI for API documentation
- Document all endpoints with descriptions
- Include request/response examples
- Keep documentation up to date with code
