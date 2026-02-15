---
name: express-typescript
description: Guidelines for building robust APIs with Express.js and TypeScript, covering middleware patterns, routing, and security best practices
---

# Express TypeScript Development

You are an expert in Express.js and TypeScript development with deep knowledge of building scalable, maintainable APIs.

## TypeScript General Guidelines

### Basic Principles

- Use English for all code and documentation
- Always declare types for variables and functions (parameters and return values)
- Avoid using `any` type - create necessary types instead
- Use JSDoc to document public classes and methods
- Write concise, maintainable, and technically accurate code
- Use functional and declarative programming patterns; avoid classes where possible
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
- Use arrow functions for middleware and handlers
- Use async/await consistently throughout the codebase
- Use the RO-RO pattern for multiple parameters

### Types and Interfaces

- Prefer interfaces over types for object shapes
- Avoid enums; use maps or const objects instead
- Use Zod for runtime validation with inferred types
- Use `readonly` for immutable properties

## Express-Specific Guidelines

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
    requestLogger.ts
    validateRequest.ts
  services/
    {domain}Service.ts
  models/
    {entity}.ts
  types/
    express.d.ts
    index.ts
  utils/
  config/
  app.ts
  server.ts
```

### Application Setup

```typescript
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import routes from './routes';

const createApp = (): Express => {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors());

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Routes
  app.use('/api', routes);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
};

export default createApp;
```

### Middleware Patterns

- Use middleware for cross-cutting concerns
- Chain middleware in order of execution
- Handle errors in dedicated error middleware

```typescript
import { Request, Response, NextFunction } from 'express';

// Request logging middleware
const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
};

// Authentication middleware
const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const user = await verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Routing

- Organize routes by resource
- Use Router for modular route definitions
- Apply middleware at appropriate levels

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { createUserSchema, updateUserSchema } from './validators';
import * as controller from './controller';

const router = Router();

router.get('/', controller.listUsers);
router.get('/:id', controller.getUser);
router.post('/', validateRequest(createUserSchema), controller.createUser);
router.put('/:id', authenticate, validateRequest(updateUserSchema), controller.updateUser);
router.delete('/:id', authenticate, controller.deleteUser);

export default router;
```

### Request Validation

- Validate all incoming requests
- Use Zod for schema definition and validation
- Create reusable validation middleware

```typescript
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

const validateRequest = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  };
};
```

### Error Handling

- Create custom error classes
- Use centralized error handler middleware
- Return consistent error responses

```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

// Error handler middleware
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
};
```

### TypeScript Extensions

Extend Express types for custom properties:

```typescript
// types/express.d.ts
import { User } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      requestId?: string;
    }
  }
}
```

### Security Best Practices

- Use helmet for security headers
- Implement rate limiting
- Sanitize user inputs
- Use HTTPS in production
- Implement CORS properly

```typescript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api', limiter);
```

### Testing

- Use Jest with supertest for integration tests
- Test middleware in isolation
- Mock external dependencies

```typescript
import request from 'supertest';
import createApp from '../app';

describe('Users API', () => {
  const app = createApp();

  it('should create a user', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'John', email: 'john@example.com', password: 'password123' })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('John');
  });
});
```
