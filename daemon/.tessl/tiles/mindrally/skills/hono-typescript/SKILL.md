---
name: hono-typescript
description: Guidelines for building edge-first, high-performance APIs with Hono and TypeScript for Cloudflare Workers, Deno, Bun, and Node.js
---

# Hono TypeScript Development

You are an expert in Hono and TypeScript development with deep knowledge of building ultrafast, edge-first APIs that run on Cloudflare Workers, Deno, Bun, and Node.js.

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
- Use arrow functions for handlers and middleware
- Prefer the RO-RO pattern: Receive an Object, Return an Object
- Use default parameters instead of null checks

### Types and Interfaces

- Prefer interfaces over types for object shapes
- Avoid enums; use maps or const objects instead for better type safety
- Use Zod for runtime validation with inferred types
- Use `readonly` for immutable properties
- Use `import type` for type-only imports

## Hono-Specific Guidelines

### Project Structure

```
src/
  routes/
    {resource}/
      index.ts
      handlers.ts
      validators.ts
  middleware/
    auth.ts
    cors.ts
    logger.ts
  services/
    {domain}Service.ts
  types/
    index.ts
  utils/
  config/
  index.ts
```

### App Initialization

```typescript
import { Hono } from 'hono';

// Type your environment bindings
type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
};

type Variables = {
  user: User;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
```

### Routing

- Use method chaining for clean route definitions
- Group related routes with `app.route()`
- Use route parameters with proper typing

```typescript
const users = new Hono<{ Bindings: Bindings }>();

users.get('/', listUsers);
users.get('/:id', getUser);
users.post('/', zValidator('json', createUserSchema), createUser);
users.put('/:id', zValidator('json', updateUserSchema), updateUser);
users.delete('/:id', deleteUser);

app.route('/api/users', users);
```

### Middleware

- Use Hono's built-in middleware where available
- Create typed middleware for custom logic
- Chain middleware for composability

```typescript
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { jwt } from 'hono/jwt';

app.use('*', logger());
app.use('/api/*', cors());
app.use('/api/*', jwt({ secret: 'your-secret' }));

// Custom middleware
const authMiddleware = async (c: Context, next: Next) => {
  const user = await validateUser(c);
  c.set('user', user);
  await next();
};
```

### Request Validation with Zod

- Use `@hono/zod-validator` for request validation
- Define schemas for all request inputs
- Infer types from Zod schemas

```typescript
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['user', 'admin']).default('user'),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

app.post('/users', zValidator('json', createUserSchema), async (c) => {
  const data = c.req.valid('json');
  // data is typed as CreateUserInput
});
```

### Context and Response Handling

- Use typed context for better type safety
- Use helper methods for responses: `c.json()`, `c.text()`, `c.html()`
- Access environment bindings through context

```typescript
app.get('/users/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;

  const user = await db.prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json(user);
});
```

### Error Handling

- Use Hono's `HTTPException` for expected errors
- Create global error handler middleware
- Return consistent error responses

```typescript
import { HTTPException } from 'hono/http-exception';

// Throwing errors
if (!user) {
  throw new HTTPException(404, { message: 'User not found' });
}

// Global error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: 'Internal Server Error' }, 500);
});
```

### Cloudflare Workers Integration

- Use Workers KV for key-value storage
- Use D1 for SQL databases
- Use R2 for object storage
- Use Durable Objects for stateful applications

```typescript
// D1 Database
const result = await c.env.DB.prepare('SELECT * FROM users').all();

// KV Storage
await c.env.KV.put('key', 'value');
const value = await c.env.KV.get('key');

// R2 Storage
await c.env.BUCKET.put('file.txt', content);
```

### Testing

- Use Hono's test client for integration tests
- Use Vitest or Jest as test runner
- Test handlers and middleware separately

```typescript
import { testClient } from 'hono/testing';
import { describe, it, expect } from 'vitest';

describe('User API', () => {
  const client = testClient(app);

  it('should list users', async () => {
    const res = await client.api.users.$get();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
```

### Performance

- Hono is ultrafast with minimal overhead
- Use streaming responses for large data
- Leverage edge caching with Cache API
- Use `hono/tiny` preset for minimal bundle size

### Security

- Use `hono/secure-headers` middleware
- Implement rate limiting
- Validate all inputs with Zod
- Use JWT for authentication
- Enable CORS appropriately

### Multi-Runtime Support

Hono runs on multiple runtimes. Configure appropriately:

```typescript
// Cloudflare Workers
export default app;

// Node.js
import { serve } from '@hono/node-server';
serve(app);

// Bun
export default app;

// Deno
Deno.serve(app.fetch);
```
