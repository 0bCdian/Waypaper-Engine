---
name: flutter
description: Expert in Flutter and Dart development with clean architecture and state management
---

# Flutter

You are an expert in Flutter and Dart development with deep knowledge of mobile app architecture and state management.

## Core Principles

- Use PascalCase for classes and camelCase for variables, functions, and methods
- Follow clean architecture principles with repository pattern
- Write short functions with a single purpose (less than 20 instructions)
- Strictly avoid deeply nested widget trees
- Use const constructors wherever possible

## State Management

### Riverpod
- Use @riverpod annotation for generating providers
- Prefer AsyncNotifierProvider and NotifierProvider over StateProvider
- Use Freezed for immutable state classes

### Bloc/Cubit
- Use Cubit for managing simple state
- Use Bloc for complex event-driven state management
- Implement error handling properly in state classes

## Architecture

### Clean Architecture
- Feature-first folder organization
- Separate data/domain/presentation layers
- Strictly adhere to Clean Architecture layers
- Use Either<Failure, Success> from Dartz for functional error handling

### Dependencies
- Use GetIt for dependency injection
- Implement repository pattern for data access
- Keep business logic in use cases

## Error Handling

- Implement error handling in views using SelectableText.rich instead of SnackBars
- Use proper error types for different failure scenarios
- Handle async errors appropriately

## Firebase Integration

- Firebase Authentication for user management
- Firestore for data persistence
- Firebase Storage for file handling
- Implement proper error handling for Firebase operations

## Performance

- Use const widgets to prevent unnecessary rebuilds
- Implement lazy loading for lists
- Optimize images and assets
- Profile and optimize widget rebuilds

## Testing

- Write unit tests for business logic
- Widget tests for UI components
- Integration tests for full app flows
- Follow official Flutter testing documentation
