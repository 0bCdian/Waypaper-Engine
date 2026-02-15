---
name: koa-typescript
description: Guidelines for building modern APIs with Koa.js and TypeScript, featuring the onion middleware model and async/await patterns
---

# Koa TypeScript Development

You are an expert in Koa.js and TypeScript development with deep knowledge of building elegant, middleware-based APIs using Koa's unique onion model.

## TypeScript General Guidelines

### Basic Principles

- Use English for all code and documentation
- Always declare types for variables and functions
- Avoid using `any` type - create necessary types instead
- Use JSDoc to document public classes and methods
- Write concise, maintainable, and technically accurate code
- Use functional and declarative programming patterns
- Prefer iteration and modularization to adhere to DRY principles

### Nomenclature

- Use PascalCase for types and interfaces
- Use camelCase for variables, functions, and methods
- Use kebab-case for file and directory names
- Use UPPERCASE for environment variables
- Use descriptive variable names with auxiliary verbs

### Functions

- Write short functions with a single purpose
- Use arrow functions for middleware
- Use async/await consistently throughout the codebase
- Use the RO-RO pattern for multiple parameters

## Koa-Specific Guidelines

### Project Structure

```
src/
  routes/
    {resource}/
      index.ts
      controller.ts
      validators.ts
  middleware/
    auth.ts
    errorHandler.ts
    requestId.ts
    logger.ts
  services/
    {domain}Service.ts
  models/
    {entity}.ts
  utils/
  config/
  app.ts
  server.ts
```

### Middleware Patterns

Koa uses a unique "onion" middleware model. Middleware functions are composed and executed in a stack-like manner.

```typescript
import { Middleware } from 'koa';

// Middleware pattern with async/await
const responseTime: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set('X-Response-Time', `${ms}ms`);
};
```

- Always use `async/await` for middleware
- Call `await next()` to pass control to downstream middleware
- Code after `await next()` runs during the "upstream" phase
- Use this pattern for request/response transformations

### Context (ctx) Best Practices

- Use `ctx.state` to pass data between middleware
- Type your context for better type safety
- Avoid mutating context directly when possible
- Use context for request/response access

```typescript
import { ParameterizedContext, Middleware } from 'koa';

interface AppState {
  user?: User;
  requestId: string;
}

type AppContext = ParameterizedContext<AppState>;

const authMiddleware: Middleware<AppState> = async (ctx, next) => {
  ctx.state.user = await validateToken(ctx.headers.authorization);
  await next();
};
```

### Application Setup

```typescript
import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import helmet from 'koa-helmet';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';

const app = new Koa();

// Error handling (first in chain)
app.use(errorHandler);

// Security
app.use(helmet());
app.use(cors());

// Body parsing
app.use(bodyParser());

// Logging
app.use(requestLogger);

// Routes
app.use(router.routes());
app.use(router.allowedMethods());

export default app;
```

### Routing with koa-router

- Use koa-router for declarative routing
- Organize routes by resource
- Keep route handlers thin
- Use middleware for cross-cutting concerns

```typescript
import Router from '@koa/router';
import * as controller from './controller';
import { validateUserInput } from './validators';

const router = new Router({ prefix: '/api/users' });

router.get('/', controller.listUsers);
router.get('/:id', controller.getUser);
router.post('/', validateUserInput, controller.createUser);
router.put('/:id', validateUserInput, controller.updateUser);
router.delete('/:id', controller.deleteUser);

export default router;
```

### Error Handling

- Create centralized error handling middleware
- Place error handler at the top of the middleware stack
- Use custom error classes for different error types
- Never expose internal error details in production

```typescript
import { Middleware } from 'koa';

class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public expose: boolean = true
  ) {
    super(message);
  }
}

const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    const error = err as Error & { status?: number; expose?: boolean };
    ctx.status = error.status || 500;
    ctx.body = {
      error: {
        message: error.expose ? error.message : 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      }
    };
    ctx.app.emit('error', err, ctx);
  }
};
```

### Request Validation

- Use koa-joi-router or Zod for validation
- Validate body, query, and params
- Return clear validation error messages
- Create reusable validation middleware

```typescript
import { z } from 'zod';
import { Middleware } from 'koa';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const validate = (schema: z.ZodSchema): Middleware => {
  return async (ctx, next) => {
    try {
      ctx.request.body = schema.parse(ctx.request.body);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        ctx.status = 400;
        ctx.body = { errors: error.errors };
        return;
      }
      throw error;
    }
  };
};
```

### Authentication

- Implement JWT authentication with koa-jwt
- Store authenticated user in `ctx.state.user`
- Create authorization middleware for role-based access

```typescript
import jwt from 'koa-jwt';

app.use(jwt({ secret: process.env.JWT_SECRET }).unless({ path: [/^\/public/] }));

const requireRole = (role: string): Middleware => {
  return async (ctx, next) => {
    if (ctx.state.user?.role !== role) {
      ctx.throw(403, 'Forbidden');
    }
    await next();
  };
};
```

### Security

- Use koa-helmet for security headers
- Implement rate limiting with koa-ratelimit
- Enable CORS with @koa/cors
- Validate and sanitize all inputs
- Use HTTPS in production

### Testing

- Use Jest or Mocha for testing
- Use supertest with app.callback() for integration tests
- Test middleware in isolation
- Mock context for unit tests

```typescript
import request from 'supertest';
import app from '../app';

describe('GET /api/users', () => {
  it('should return users list', async () => {
    const response = await request(app.callback())
      .get('/api/users')
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
  });
});
```

### Performance

- Use koa-compress for response compression
- Implement caching with koa-redis-cache
- Use connection pooling for databases
- Implement pagination for list endpoints
- Consider koa-static for serving static files

### Environment Configuration

- Use dotenv for environment variables
- Validate required environment variables at startup
- Create separate configs for different environments
- Never commit secrets to version control
