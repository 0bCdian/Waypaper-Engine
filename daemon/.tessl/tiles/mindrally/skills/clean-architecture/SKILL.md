---
name: clean-architecture
description: Guidelines for implementing Clean Architecture patterns in Flutter and Go applications, with emphasis on separation of concerns, dependency rules, and testability.
---

# Clean Architecture

You are an expert in Clean Architecture patterns for application development.

## Core Principles

Clean Architecture enforces separation of concerns through distinct layers with dependencies pointing inward:

1. **Domain Layer** (innermost) - Business logic and entities
2. **Application Layer** - Use cases and application-specific logic
3. **Infrastructure Layer** - External concerns (databases, APIs, frameworks)
4. **Presentation Layer** (outermost) - UI and user interaction

The fundamental rule: inner layers must never depend on outer layers.

## Flutter + Clean Architecture

### Architecture Layers
- **Presentation**: Widgets, BLoCs, and UI components
- **Domain**: Entities, use cases, and repository interfaces
- **Data**: Repository implementations, data sources, and models

### Feature-first Organization
```
feature/
  data/
    datasources/
    models/
    repositories/
  domain/
    entities/
    repositories/
    usecases/
  presentation/
    bloc/
    pages/
    widgets/
```

### State Management with flutter_bloc
- Use flutter_bloc for state management
- Implement immutable states via Freezed
- Handle events and states with proper patterns
- Keep BLoCs focused on single responsibilities

### Error Handling
- Implement Either<Failure, Success> pattern from Dartz
- Use functional error handling without exceptions
- Define clear Failure types for different error scenarios

### Key Libraries
- `flutter_bloc` - State management
- `freezed` - Immutable classes and unions
- `get_it` - Service locator for DI
- `dartz` - Functional programming utilities

## Go Backend Clean Architecture

### Layer Separation
- **Handlers** - HTTP/gRPC request handling
- **Services** - Business logic and use cases
- **Repositories** - Data access abstractions
- **Domain Models** - Core business entities

### Interface-driven Development
- Define interfaces for all dependencies
- Implement dependency injection through constructors
- Keep interfaces small and focused
- Allow easy mocking for tests

### Project Structure
```
project/
  cmd/              # Application entry points
  internal/
    domain/         # Business entities and interfaces
    service/        # Business logic implementation
    repository/     # Data access implementation
    handler/        # HTTP/gRPC handlers
  pkg/              # Shared utilities
```

### Testing Strategy
- Write table-driven unit tests with mocks
- Separate fast unit tests from integration tests
- Use interfaces to inject test doubles
- Achieve high coverage of business logic
