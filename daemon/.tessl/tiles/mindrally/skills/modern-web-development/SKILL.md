---
name: modern-web-development
description: Modern web development best practices for TypeScript, Next.js 14, React Server Components, Supabase, GraphQL, and Tailwind CSS.
---

# Modern Web Development

Brandon Fernandez's comprehensive cursor rules for modern web development with TypeScript, Node.js, Next.js 14, React, Supabase, GraphQL, Tailwind CSS, Radix UI, and Shadcn UI.

## Key Development Principles

### Code Style and Architecture

- Write concise, technical responses with accurate TypeScript examples
- Employ functional, declarative programming while avoiding class-based approaches
- Prioritize iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (`isLoading`, `hasError`)
- Implement the RORO pattern (Receive an Object, Return an Object)

### JavaScript/TypeScript Standards

- Use `function` keyword for pure functions
- Omit semicolons
- Leverage TypeScript exclusively, preferring interfaces over types
- Structure files as: exported component, subcomponents, helpers, static content, types
- Minimize unnecessary curly braces in conditionals

### Error Handling

- Address errors and edge cases at function entry points
- Apply early returns for error conditions avoiding deep nesting
- Position the success path last for improved readability
- Use guard clauses for precondition validation
- Implement user-friendly error messaging

## React and Next.js Guidelines

- Use functional components with TypeScript interfaces
- Write declarative JSX using `function` declarations
- Style with Shadcn UI, Radix, and Tailwind CSS
- Implement mobile-first responsive design
- Minimize `use client`, `useEffect`, and `setState` - favor React Server Components
- Employ Zod for form validation
- Wrap client components in Suspense with fallbacks
- Use dynamic loading for non-critical components
- Optimize images (WebP format, size data, lazy loading)

## Data and State Management

- Leverage React Server Components for data fetching
- Implement the preload pattern to prevent waterfalls
- Use Supabase for real-time synchronization and state management
- Consider Vercel KV for chat history, rate limiting, and sessions

## Supabase and GraphQL

- Use Supabase client for database interactions and subscriptions
- Implement Row Level Security (RLS) policies
- Leverage Supabase Auth, Storage, and Edge Functions
- Use Genql for type-safe GraphQL API interactions
- Optimize GraphQL queries to fetch only necessary data

## Styling and Testing

### Styling

- Apply Tailwind CSS utility-first approach
- Use Class Variance Authority (CVA) for component variants

### Testing

- Implement unit tests for utilities and hooks
- Create integration tests for complex components
- Develop end-to-end tests for critical user flows

## Accessibility and Documentation

### Accessibility

- Ensure keyboard navigation throughout interfaces
- Implement proper ARIA labels and semantic roles
- Maintain WCAG-compliant color contrast ratios

### Documentation

- Provide clear JSDoc comments for IDE intellisense
- Document Supabase schemas, RLS policies, and Edge Functions
