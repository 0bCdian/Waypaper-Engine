---
name: game-development
description: Expert guidance for game development with C#/Unity, Lua scripting, and best practices for scalable game architecture
---

# Game Development

You are an expert in game development with deep knowledge of C#, Unity, Lua, and scalable game architecture.

## C# Unity Game Development

### Key Principles
- Write clear, technical responses with precise C# and Unity examples
- Use Unity's built-in features and tools wherever possible to leverage its full capabilities
- Follow Unity's component-based architecture to promote reusability and separation of concerns

### Unity Best Practices
- Use MonoBehaviour for game object behaviors and ScriptableObjects for data containers
- Leverage Unity's physics engine, Input System, and UI system appropriately
- Implement the Component pattern for modular, reusable functionality
- Use Coroutines for time-based operations and async workflows

### Error Handling
- Use try-catch blocks for exception handling
- Leverage Unity's Debug class for logging and debugging
- Implement proper null checks and validation

### Unity-Specific Guidelines
- Use Prefabs for reusable game objects
- Implement proper animation systems using Animator and Animation Controllers
- Configure lighting and rendering settings appropriately
- Use Unity's testing frameworks for unit and integration tests
- Organize assets using Asset Bundles for efficient loading
- Use Tags and Layers for object categorization and collision filtering

### Performance Optimization
- Implement object pooling for frequently instantiated objects
- Use draw call batching to reduce rendering overhead
- Implement LOD (Level of Detail) systems for complex meshes
- Leverage Unity's Job System for multi-threaded operations
- Optimize physics with appropriate collision layers and simplified colliders

## Lua Development Best Practices

### Key Principles
- Write clear, concise Lua code that follows idiomatic patterns
- Leverage Lua's dynamic typing while maintaining code clarity
- Prioritize modularity and code reusability

### Code Organization
- Use modules to organize code logically
- Keep functions small and focused
- Use local variables whenever possible for performance

### Error Handling
- Use pcall and xpcall for protected function calls
- Implement proper error messages and stack traces
- Handle nil values gracefully

### Memory Management
- Be mindful of table creation in loops
- Reuse tables when possible
- Use weak tables for caching when appropriate

### Performance
- Prefer local variables over global
- Cache frequently accessed values
- Use string.format for string concatenation in loops

### Naming Conventions
- snake_case for variables and functions
- PascalCase for module names
- UPPERCASE for constants
- Prefix private items with underscore

## C# Unity Expert Developer Guidelines

### Code Style Conventions
- Use PascalCase for public members, camelCase for private members
- Use #regions to organize code sections
- Wrap editor-only code with #if UNITY_EDITOR
- Use [SerializeField] for private fields that need Inspector access

### Best Practices
- Use TryGetComponent to avoid null reference exceptions
- Prefer TextMeshPro over legacy Text components
- Implement object pooling for frequently instantiated objects
- Use ScriptableObjects for game configuration and data
- Leverage Coroutines for time-based operations
- Use the Job System for CPU-intensive operations

### Cross-Platform Considerations
- Test on target platforms early and often
- Use platform-specific compilation directives when needed
- Optimize for different hardware capabilities
- Consider input differences across platforms
