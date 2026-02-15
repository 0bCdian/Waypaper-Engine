---
name: android-development
description: Android development guidelines for Kotlin with clean architecture, MVI pattern, Material Design, and best practices for building robust mobile applications
---

# Android Development Best Practices

## General Kotlin Guidelines

### Basic Principles
- Use English for all code and documentation
- Always declare variable and function types explicitly
- Avoid the `any` type; create necessary custom types
- Eliminate blank lines within function bodies

### Naming Standards
- **PascalCase**: Classes, interfaces, enums
- **camelCase**: Variables, functions, methods
- **underscores_case**: Files and directories
- **UPPERCASE**: Environment variables, constants
- Avoid magic numbers; define constants instead
- Functions should start with action verbs
- Boolean variables use prefixes: `isLoading`, `hasError`, `canDelete`

### Function Design
- Keep functions under 20 instructions with single responsibility
- Use verb-based naming
- Prefix boolean returns with `is`, `has`, or `can`
- Prefix void returns with `execute`, `save`, `send`
- Combat nesting through early returns, utility extraction, and higher-order functions
- Use default parameters instead of null checks
- Consolidate parameters into objects (RO-RO pattern)

### Data and Classes
- Employ data classes for data structures
- Encapsulate primitives in composite types; validate internally
- Favor immutability; use `val` for unchanging values
- Follow SOLID principles; prefer composition over inheritance
- Keep classes under 200 instructions, 10 public methods, 10 properties

### Exception Handling
- Reserve exceptions for unexpected errors
- Catch exceptions only to fix anticipated issues or add context
- Create custom exception types for domain errors

## Android Architecture

### Clean Architecture
- Implement clean architecture with clear layer separation
- Use repository pattern for data persistence and caching
- Keep business logic in Use Cases or Interactors
- Separate concerns between UI, domain, and data layers

### Project Structure
```
app/
├── data/           # Data sources, repositories, models
├── domain/         # Use cases, domain models, interfaces
├── presentation/   # UI components, ViewModels, state
└── di/             # Dependency injection modules
```

### MVI Pattern
- Deploy MVI pattern for state and event management
- ViewModels manage UI state as a single immutable state object
- UI components observe state and render accordingly
- Handle user intents/events through a single entry point
- Keep side effects predictable and traceable

## UI Development

### Navigation
- Use Navigation Component for fragment and activity routing
- Define navigation graph for app flow
- Handle deep links through Navigation Component
- Implement safe args for type-safe navigation arguments

### Main Activity Structure
- MainActivity manages primary navigation
- Use BottomNavigationView for main destinations (Home, Profile, Settings, etc.)
- Handle navigation state properly across configuration changes

### View Binding and State
- Use ViewBinding for type-safe view access
- Use Flow or LiveData for UI state management
- Observe state changes in lifecycle-aware manner
- Handle loading, error, and success states consistently

### UI Framework Preferences
- Prefer XML layouts and Fragments over Jetpack Compose (unless Compose is specifically required)
- Use ConstraintLayout for complex layouts
- Apply Material 3 design guidelines
- Follow responsive design practices for different screen sizes

## Authentication Flow

Structure authentication screens properly:
1. Splash Screen - Initial app launch
2. Login Screen - User authentication
3. Register Screen - New user registration
4. Forgot Password Screen - Password recovery
5. Verify Email Screen - Email verification

## Testing

### Unit Testing
- Follow Arrange-Act-Assert conventions
- Test ViewModels, Use Cases, and Repositories
- Use test doubles for dependencies
- Achieve good coverage of business logic

### UI Testing
- Implement widget testing for UI components
- Write integration tests for API modules
- Test navigation flows
- Use Espresso for instrumented tests

## Best Practices

### Lifecycle Management
- Handle lifecycle events properly
- Avoid memory leaks from improper lifecycle handling
- Use lifecycle-aware components

### Background Processing
- Use Coroutines for async operations
- Handle cancellation properly
- Use WorkManager for deferrable background work

### Dependency Injection
- Use Hilt or Dagger for dependency injection
- Scope dependencies appropriately
- Keep DI configuration organized

### Performance
- Avoid work on the main thread
- Optimize RecyclerView with DiffUtil
- Use lazy loading for heavy resources
- Profile and optimize memory usage
