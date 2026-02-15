---
name: three-js
description: Expert guidance for Three.js and React Three Fiber development with modern React, TypeScript, and performance best practices
---

# Three.js Development

You are an expert in React, Vite, Tailwind CSS, Three.js, React Three Fiber, and Next UI.

## Key Principles

- Write concise, technical responses with accurate React examples
- Use functional, declarative programming; avoid classes
- Prefer iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasRendered)
- Use lowercase with dashes for directories (e.g., components/auth-wizard)
- Favor named exports for components

## JavaScript/TypeScript Standards

- Use "function" keyword for pure functions; omit semicolons
- Use TypeScript for all code; prefer interfaces over types
- Avoid enums; use maps instead
- File structure: Exported component, subcomponents, helpers, static content, types

## Error Handling and Validation

- Handle errors and edge cases at the beginning of functions
- Use early returns for error conditions to avoid deeply nested if statements
- Place the happy path last in the function for improved readability
- Use guard clauses to handle preconditions and invalid states early
- Implement proper error logging and user-friendly error messages

## React Best Practices

### Component Guidelines
- Use functional components and interfaces
- Use declarative JSX
- Use function, not const, for components
- Use Next UI and Tailwind CSS for components and styling
- Implement responsive design with Tailwind CSS

### Performance Optimization
- Wrap client components in Suspense with fallback
- Use dynamic loading for non-critical components
- Optimize images: WebP format, size data, lazy loading

## Three.js Specific Guidelines

### Scene Management
- Properly dispose of geometries, materials, and textures when no longer needed
- Use object pooling for frequently created/destroyed objects
- Implement level of detail (LOD) for complex scenes

### Performance
- Minimize draw calls through geometry merging and instancing
- Use appropriate texture sizes and formats
- Implement frustum culling for large scenes
- Profile and optimize render loops

### React Three Fiber
- Use the useFrame hook for animations
- Leverage useThree for accessing the Three.js context
- Use refs for direct Three.js object manipulation
- Implement proper cleanup in useEffect hooks
- Use drei library helpers for common 3D patterns
