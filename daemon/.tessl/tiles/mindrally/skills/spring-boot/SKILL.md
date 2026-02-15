---
name: spring-boot
description: Expert guidance for Spring Boot application development with best practices for RESTful APIs, testing, security, and deployment
---

# Spring Boot

You are an expert in Java programming, Spring Boot, Spring Framework, Maven, JUnit, and related Java technologies.

## Code Style and Structure

- Write clean, efficient, and well-documented Java code using Spring Boot conventions
- Follow RESTful API design patterns for web services
- Use descriptive method and variable names following camelCase convention
- Structure applications with consistent package organization (controllers, services, repositories, models, configurations)

## Spring Boot Specifics

- Leverage Spring Boot starters for rapid application development
- Use auto-configuration effectively to minimize boilerplate
- Implement proper annotations (@SpringBootApplication, @RestController, @Service, @Repository)
- Handle exceptions globally via @ControllerAdvice and @ExceptionHandler

## Naming Conventions

- Use PascalCase for class names (e.g., UserController, OrderService)
- Use camelCase for method and variable names (e.g., findUserById, isOrderValid)
- Use ALL_CAPS for constants (e.g., MAX_RETRY_ATTEMPTS, DEFAULT_PAGE_SIZE)

## Java and Spring Boot Usage

- Use Java 17 or later features when applicable (e.g., records, sealed classes, pattern matching)
- Leverage Spring Boot 3.x capabilities and features
- Use Spring Data JPA for database operations with proper entity relationships
- Implement Bean Validation using Jakarta Validation annotations

## Configuration and Properties

- Store configuration in application.properties or application.yml
- Use @Value or @ConfigurationProperties for type-safe configuration injection
- Implement environment-specific configurations using Spring Profiles (dev, test, prod)

## Dependency Injection

- Prefer constructor injection over field injection for better testability
- Use CDI annotations appropriately (@Autowired, @Qualifier)
- Follow the principle of programming to interfaces

## Testing

- Write comprehensive unit tests using JUnit 5 and Spring Boot Test
- Use MockMvc for testing REST endpoints and web layer components
- Implement integration tests with @SpringBootTest
- Use @DataJpaTest for repository layer testing
- Leverage Testcontainers for database integration testing

## Performance and Scalability

- Implement caching strategies using Spring Cache abstraction
- Use @Async for asynchronous, non-blocking operations
- Optimize database queries using proper indexing and fetch strategies
- Consider connection pooling with HikariCP

## Security

- Implement Spring Security for authentication and authorization
- Use BCrypt for secure password encoding
- Configure CORS settings appropriately for web applications
- Implement proper input validation to prevent injection attacks

## Logging and Monitoring

- Use SLF4J with Logback for structured logging
- Implement appropriate log levels (ERROR, WARN, INFO, DEBUG)
- Leverage Spring Boot Actuator for health checks, metrics, and monitoring
- Integrate with monitoring tools (Prometheus, Grafana)

## API Documentation

- Use Springdoc OpenAPI for comprehensive API documentation
- Provide detailed annotations for endpoints, parameters, and responses
- Generate interactive API documentation with Swagger UI

## Build and Deployment

- Use Maven or Gradle for dependency management and builds
- Implement multi-stage Docker builds for optimized container images
- Configure CI/CD pipelines for automated testing and deployment
- Use environment variables for sensitive configuration

## General Best Practices

- Follow RESTful API design principles with proper HTTP methods and status codes
- Design for microservices architecture when appropriate
- Adhere to SOLID principles for clean, maintainable code
- Maintain high cohesion within components and low coupling between them
- Implement proper error handling with meaningful error responses
