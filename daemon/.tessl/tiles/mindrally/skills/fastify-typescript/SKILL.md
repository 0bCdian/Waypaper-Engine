---
name: fastify-typescript
description: Guidelines for building high-performance APIs with Fastify and TypeScript, covering validation, Prisma integration, and testing best practices
---

# Fastify TypeScript Development

You are an expert in Fastify and TypeScript development with deep knowledge of building high-performance, type-safe APIs.

## TypeScript General Guidelines

### Basic Principles

- Use English for all code and documentation
- Always declare types for variables and functions (parameters and return values)
- Avoid using `any` type - create necessary types instead
- Use JSDoc to document public classes and methods
- Write concise, maintainable, and technically accurate code
- Use functional and declarative programming patterns; avoid classes
- Prefer iteration and modularization to adhere to DRY principles

### Nomenclature

- Use PascalCase for types and interfaces
- Use camelCase for variables, functions, and methods
- Use kebab-case for file and directory names
- Use UPPERCASE for environment variables
- Use descriptive variable names with auxiliary verbs: `isLoading`, `hasError`, `canDelete`
- Start each function with a verb

### Functions

- Write short functions with a single purpose
- Use arrow functions for simple operations
- Use async/await consistently throughout the codebase
- Use the RO-RO pattern (Receive an Object, Return an Object) for multiple parameters

### Types and Interfaces

- Prefer interfaces over types for object shapes
- Avoid enums; use maps or const objects instead
- Use Zod for runtime validation with inferred types
- Use `readonly` for immutable properties
- Use `import type` for type-only imports

## Fastify-Specific Guidelines

### Project Structure

```
src/
  routes/
    {resource}/
      index.ts
      handlers.ts
      schemas.ts
  plugins/
    auth.ts
    database.ts
    cors.ts
  services/
    {domain}Service.ts
  repositories/
    {entity}Repository.ts
  types/
    index.ts
  utils/
  config/
  app.ts
  server.ts
```

### Route Organization

- Organize routes by resource/domain
- Use route plugins for modular registration
- Define schemas alongside route handlers
- Use route prefixes for API versioning

```typescript
import { FastifyPluginAsync } from 'fastify';

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { schema: listUsersSchema }, listUsersHandler);
  fastify.get('/:id', { schema: getUserSchema }, getUserHandler);
  fastify.post('/', { schema: createUserSchema }, createUserHandler);
  fastify.put('/:id', { schema: updateUserSchema }, updateUserHandler);
  fastify.delete('/:id', { schema: deleteUserSchema }, deleteUserHandler);
};

export default usersRoutes;
```

### Schema Validation with JSON Schema / Ajv

- Define JSON schemas for all request/response validation
- Use @sinclair/typebox for type-safe schema definitions
- Leverage Fastify's built-in Ajv integration

```typescript
import { Type, Static } from '@sinclair/typebox';

const UserSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String({ minLength: 1 }),
  email: Type.String({ format: 'email' }),
  createdAt: Type.String({ format: 'date-time' }),
});

type User = Static<typeof UserSchema>;

const createUserSchema = {
  body: Type.Object({
    name: Type.String({ minLength: 1 }),
    email: Type.String({ format: 'email' }),
  }),
  response: {
    201: UserSchema,
    400: ErrorSchema,
  },
};
```

### Plugins and Decorators

- Use plugins for shared functionality
- Decorate Fastify instance with services and utilities
- Register plugins with proper encapsulation

```typescript
import fp from 'fastify-plugin';

const databasePlugin = fp(async (fastify) => {
  const prisma = new PrismaClient();

  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});

export default databasePlugin;
```

### Prisma Integration

- Use Prisma as the ORM for database operations
- Create repository classes for data access
- Use transactions for complex operations

```typescript
class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: CreateUserInput): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
```

### Error Handling

- Use Fastify's built-in error handling
- Create custom error classes for domain errors
- Return consistent error responses

```typescript
import { FastifyError } from 'fastify';

class NotFoundError extends Error implements FastifyError {
  code = 'NOT_FOUND';
  statusCode = 404;

  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode || 500;

  reply.status(statusCode).send({
    error: error.name,
    message: error.message,
    statusCode,
  });
});
```

### Testing with Jest

- Write unit tests for services and handlers
- Use integration tests for routes
- Mock external dependencies

```typescript
import { build } from '../app';

describe('Users API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should list users', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/users',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toBeInstanceOf(Array);
  });
});
```

### Performance

- Fastify is one of the fastest Node.js frameworks
- Use schema validation for automatic serialization optimization
- Enable logging only when needed in production
- Use connection pooling for database connections

### Security

- Use @fastify/helmet for security headers
- Implement rate limiting with @fastify/rate-limit
- Use @fastify/cors for CORS configuration
- Validate all inputs with JSON Schema
- Use JWT for authentication with @fastify/jwt
