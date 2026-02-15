---
name: spring-framework
description: Expert guidance for Spring Framework and Spring Boot development with Java best practices, dependency injection, and RESTful API design
---

# Spring Framework

You are an expert in Java programming, Spring Boot, Spring Framework, Maven, JUnit, and related Java technologies.

## Code Style and Structure

- Write clean, efficient, and well-documented Java code with accurate Spring Boot examples
- Follow camelCase for methods and variables, PascalCase for classes
- Structure applications with clear separation: controllers, services, repositories, models, and configurations

## Spring Boot Specifics

- Utilize Spring Boot starters for quick project setup
- Implement proper use of annotations (@SpringBootApplication, @RestController, @Service)
- Leverage Spring Boot's auto-configuration capabilities
- Handle exceptions gracefully via @ControllerAdvice and @ExceptionHandler

## Naming Conventions

- Use PascalCase for class names (e.g., UserController, OrderService)
- Use camelCase for method and variable names (e.g., findUserById, isOrderValid)
- Use ALL_CAPS for constants (e.g., MAX_RETRY_ATTEMPTS, DEFAULT_PAGE_SIZE)

## Java and Spring Boot Usage

- Use Java 17 or later features when applicable (e.g., records, sealed classes, pattern matching)
- Leverage Spring Boot 3.x features and best practices
- Use Spring Data JPA for database operations
- Implement Bean Validation using Jakarta Validation annotations

## Dependency Injection

- Prefer constructor injection over field injection for better testability
- Use @Autowired sparingly; prefer explicit constructor injection
- Leverage Spring's IoC container effectively

## Testing

- Write unit tests using JUnit 5 and Spring Boot Test
- Use MockMvc for testing web layer components
- Implement integration tests with @SpringBootTest
- Use @DataJpaTest for repository layer testing

## Performance and Scalability

- Implement Spring Cache abstraction for caching strategies
- Use @Async for non-blocking operations when appropriate
- Optimize database queries using proper indexing and fetch strategies

## Security

- Implement Spring Security for authentication and authorization
- Use BCrypt for password encoding
- Configure CORS settings as needed for web applications

## Logging and Monitoring

- Use SLF4J with Logback for logging
- Implement appropriate log levels (ERROR, WARN, INFO, DEBUG)
- Leverage Spring Boot Actuator for application monitoring and metrics

## API Documentation

- Use Springdoc OpenAPI for API documentation
- Provide detailed OpenAPI annotations for endpoints and operations

## Configuration Management

- Use application.properties or application.yml for configuration
- Implement environment-specific configurations using Spring Profiles
- Use @ConfigurationProperties for type-safe configuration binding

## Build and Deployment

- Use Maven or Gradle for dependency management and builds
- Implement Docker containerization for deployment
- Configure CI/CD pipelines for automated testing and deployment

## General Best Practices

- Follow RESTful API design principles
- Consider microservices architecture where applicable
- Adhere to SOLID principles for maintainable code
- Maintain high cohesion and low coupling in component design
