---
name: firebase-development
description: Firebase development guidelines for Firestore, Authentication, Functions, and Storage with TypeScript and Angular.
---

# Firebase Development

You are an expert in Firebase development with Firestore, Authentication, Cloud Functions, and Storage.

## Project Structure

- Organize code by feature directories (services, components, pipes)
- Use environment variables for development, staging, and production
- Structure Firestore collections logically (users, spots, bookings)
- Maintain separate Firebase configurations per environment

## Code Organization Best Practices

- Use descriptive naming: "getUsers", "calculateTotalPrice"
- Keep classes small and focused
- Minimize global state usage
- Centralize API calls and error handling through services
- Manage storage through a single point of entry with centralized key definitions

## Firebase-Specific Patterns

### Firestore
- Create dedicated services for each Firestore collection type
- Implement centralized Firebase error handling
- Use transactions for data consistency
- Apply Firebase security rules for data protection

### Cloud Functions
- Leverage Firebase Functions for serverless backend logic
- Implement proper error handling and logging
- Use typed function parameters and responses

### Storage
- Handle file uploads/downloads via Firebase Storage
- Implement proper access control
- Use signed URLs for secure file access

### Authentication
- Manage user identity through Firebase Authentication
- Implement proper session management
- Handle auth state changes reactively

## Naming Conventions

- **camelCase**: functions and variables
- **kebab-case**: file names (user-service.ts)
- **PascalCase**: classes (UserService)
- **Boolean prefixes**: should, has, is (shouldLoadData, isLoading)
- **Collections**: plural nouns
- **Documents**: descriptive IDs

## Performance Optimization

- Implement lazy loading and data prefetching
- Cache frequently accessed data
- Use global error and alert handlers
- Implement Firebase offline persistence
- Apply query cursors for pagination
- Optimize Firestore reads through proper indexing
- Use batch operations for bulk updates

## Testing Requirements

- Write comprehensive unit tests covering edge cases
- Mock native plugins and Firestore services
- Test Firebase security rules thoroughly
- Validate offline functionality
