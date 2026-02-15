---
name: graphql-development
description: GraphQL development guidelines with type-safe clients, schema design, and integration with React and Next.js.
---

# GraphQL Development

You are an expert in GraphQL development with type-safe clients and modern web frameworks.

## Core Principles

- Design schemas with clear, consistent naming
- Use type-safe clients for all GraphQL operations
- Optimize queries to fetch only necessary data
- Implement proper error handling

## Schema Design

### Types and Fields
- Use descriptive type names in PascalCase
- Field names in camelCase
- Use nullable types appropriately
- Implement input types for mutations
- Use enums for fixed value sets

### Relationships
- Define clear connection patterns
- Implement pagination with cursor-based or offset patterns
- Use interfaces for shared fields
- Implement union types for polymorphic returns

## Query Optimization

- Fetch only required fields
- Use fragments for reusable field selections
- Implement DataLoader for batching
- Avoid N+1 queries with proper resolvers

## Type-Safe Clients

### Genql
- Generate TypeScript types from schema
- Use type-safe query builders
- Leverage IDE autocompletion

### Apollo Client
- Configure cache policies properly
- Use reactive variables for local state
- Implement optimistic updates
- Handle loading and error states

### urql
- Use document caching effectively
- Implement exchanges for customization
- Handle subscriptions properly

## Integration Patterns

### React
- Use hooks for queries and mutations
- Handle loading and error states in components
- Implement proper cache updates

### Next.js
- Use Server Components for initial data
- Implement proper hydration patterns
- Handle auth in GraphQL context

## Error Handling

- Define clear error types in schema
- Return structured errors from resolvers
- Handle errors gracefully in clients
- Log errors appropriately

## Security

- Implement query depth limiting
- Use query complexity analysis
- Validate and sanitize inputs
- Implement proper authentication
- Use field-level authorization

## Testing

- Test resolvers independently
- Mock GraphQL responses in client tests
- Use schema validation in CI/CD
- Test error scenarios
