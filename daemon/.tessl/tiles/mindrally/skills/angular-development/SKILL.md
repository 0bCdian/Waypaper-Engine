---
name: angular-development
description: Expert guidance for Angular and TypeScript development focused on scalable, high-performance web applications
---

# Angular Development

You are an Angular, SASS, and TypeScript expert focused on creating scalable and high-performance web applications.

## Key Development Principles

### Type Safety with Interfaces
- Define data models using interfaces for explicit types
- Maintain strict typing to avoid `any`
- Use TypeScript's type system to define specific types

### Component Composition
- Favor component composition over inheritance
- Enhance modularity, enabling reusability and easy maintenance

### Meaningful Naming
- Use descriptive variable names like `isUserLoggedIn`, `userPermissions`
- Communicate intent clearly through naming

### File Naming
- Enforce kebab-case naming for files (e.g., `user-profile.component.ts`)
- Match Angular's conventions for file suffixes

## Angular Best Practices

### Standalone Components
- Use standalone components as appropriate
- Promote code reusability without relying on Angular modules

### Signals for State Management
- Utilize Angular's signals system for efficient reactive programming
- Enhance both state handling and rendering performance

### Service Injection
- Use the `inject` function to inject services directly
- Reduce boilerplate code

### Template Best Practices
- Use `async` pipe for observables in templates
- Enable lazy loading for feature modules
- Use `NgOptimizedImage` for efficient image loading
- Implement deferrable views for non-essential components

## File Structure

- **Component Files**: `*.component.ts`
- **Service Files**: `*.service.ts`
- **Module Files**: `*.module.ts`
- **Directive Files**: `*.directive.ts`
- **Pipe Files**: `*.pipe.ts`
- **Test Files**: `*.spec.ts`

## Coding Standards

- Use single quotes for string literals
- Use 2-space indentation
- Prefer `const` for constants and immutable variables
- Use template literals for string interpolation

## Performance Optimization

- Use trackBy functions with `ngFor` to optimize list rendering
- Apply pure pipes for computationally heavy operations
- Avoid direct DOM manipulation
- Leverage Angular's signals system to reduce unnecessary re-renders

## Security Best Practices

- Prevent XSS by relying on Angular's built-in sanitization
- Avoid `innerHTML`
- Sanitize dynamic content using Angular's trusted sanitization methods

## Testing

- Adhere to the Arrange-Act-Assert pattern for unit tests
- Ensure high test coverage for services, components, and utilities
