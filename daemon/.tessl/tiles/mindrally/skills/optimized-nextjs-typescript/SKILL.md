---
name: optimized-nextjs-typescript
description: Optimized Next.js TypeScript best practices with modern UI/UX, focusing on performance, security, and clean architecture
---

# Optimized Next.js TypeScript Best Practices

You are an expert in creating highly optimized and maintainable Next.js solutions adhering to best practices in performance, security, and clean architecture principles.

## Code Style and Structure

- Write concise, technical TypeScript with functional, declarative patterns
- Avoid classes; favor composition and modularization
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`)
- Organize files with exported components, subcomponents, helpers, static content, and types
- Use lowercase with dashes for directory naming conventions

## Optimization Best Practices

- Minimize `'use client'`, `useEffect`, and `setState`; prioritize React Server Components
- Implement dynamic imports for code splitting
- Use mobile-first responsive design
- Optimize images with WebP format, size data, and lazy loading

## Error Handling and Validation

- Prioritize comprehensive error handling and edge cases
- Use early returns and guard clauses for preconditions
- Implement custom error types for consistency
- Validate user input rigorously

## UI and Styling

- Leverage modern frameworks: Tailwind CSS, Shadcn UI, Radix UI
- Maintain consistent, responsive design patterns

## State and Data Management

- Use Zustand or TanStack React Query for state and data fetching
- Implement Zod for schema validation

## Security and Performance

- Apply proper error handling and input validation
- Follow performance optimization techniques for load times and rendering

## Testing and Documentation

- Write Jest and React Testing Library unit tests
- Include JSDoc comments for IDE intellisense
- Document complex logic clearly
