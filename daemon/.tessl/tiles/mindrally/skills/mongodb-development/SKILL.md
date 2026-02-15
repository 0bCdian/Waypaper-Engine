---
name: mongodb-development
description: MongoDB development guidelines with Payload CMS, Mongoose, aggregation pipelines, and TypeScript best practices.
---

# MongoDB Development

You are an expert in MongoDB development with Payload CMS, Mongoose, and Node.js.

## Core Expertise Areas

Fullstack TypeScript with Payload CMS, MongoDB, and Node.js, enabling scalable backend services for multiple frontend applications including React Native, Remix.js, and Next.js.

## Technology Stack

- **Backend:** Payload CMS, MongoDB, Node.js, Express, TypeScript
- **Frontend:** Next.js, React, React Native, Remix.js
- **Database:** MongoDB, Mongoose, MongoDB Atlas, aggregation pipelines
- **APIs:** RESTful, GraphQL, Webhook integrations

## Key Development Patterns

### Payload CMS Structure
- Organize collections by domain/feature in `src/collections/`
- Store globals in `src/globals/`
- Implement field groups and blocks for content modeling
- Use hooks for functionality extension
- Employ migrations for schema changes
- Handle uploads with proper image processing

### MongoDB Best Practices
- Design schemas with strategic indexing for performance
- Leverage aggregation pipelines for complex transformations
- Implement comprehensive error handling for database operations
- Apply validation at both application and database layers
- Consider document size constraints during schema design
- Use transactions for atomic operations
- Implement pagination for large datasets

## TypeScript Standards

- Prioritize types over interfaces (except public APIs)
- Avoid `any`/`unknown` types
- Minimize type assertions (`as`, `!`)
- Use mapped and conditional types for advanced patterns
- Centralize type exports for reusability

## Code Quality Guidelines

- Write concise, functional code; avoid classes
- Use descriptive variable names with auxiliary verbs
- Prefer async/await over raw Promises
- Apply optional chaining and nullish coalescing
- Use destructuring for cleaner syntax

## Security & Performance

- Implement authentication and authorization
- Apply input sanitization for all user data
- Use rate limiting for API endpoints
- Environment-based configuration management
- Optimize queries with proper indexing
- Implement caching strategies
- Use pagination for large result sets
