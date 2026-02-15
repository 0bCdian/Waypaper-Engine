---
name: trpc
description: Guidelines for writing Next.js apps with tRPC v11 for end-to-end typesafe APIs
---

# tRPC Best Practices

You are an expert in tRPC v11, TypeScript, and Next.js development. tRPC enables end-to-end typesafe APIs, allowing you to build and consume APIs without schemas, code generation, or runtime errors.

## Requirements

- TypeScript >= 5.7.2
- Strict TypeScript mode enabled

## Project Structure

```
src/
  pages/
    _app.tsx              # createTRPCNext setup
    api/
      trpc/
        [trpc].ts         # tRPC HTTP handler
  server/
    routers/
      _app.ts             # Main router
      [feature].ts        # Feature-specific routers
    context.ts            # App context
    trpc.ts               # Procedure helpers
  utils/
    trpc.ts               # Typesafe React hooks
```

## Server-Side Setup

### Initialize tRPC Backend

Initialize tRPC backend once per application. Export reusable router and procedure helpers:

```typescript
// server/trpc.ts
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(isAdmin);
```

### Create Feature Routers

Organize routers by feature/domain. Use Zod for input validation:

```typescript
// server/routers/user.ts
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';

export const userRouter = router({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUnique({ where: { id: input.id } });
    }),

  update: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.update({
        where: { id: ctx.user.id },
        data: input,
      });
    }),
});
```

### Main App Router

```typescript
// server/routers/_app.ts
import { router } from '../trpc';
import { userRouter } from './user';
import { postRouter } from './post';

export const appRouter = router({
  user: userRouter,
  post: postRouter,
});

export type AppRouter = typeof appRouter;
```

## Client-Side Setup

### Configure tRPC Client

```typescript
// utils/trpc.ts
import { httpBatchLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';
import superjson from 'superjson';
import type { AppRouter } from '../server/routers/_app';

function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      transformer: superjson,
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          maxURLLength: 2083,
        }),
      ],
    };
  },
  ssr: false,
});
```

## Key Best Practices

### 1. Input Validation
Always use Zod for type safety and runtime validation on all procedure inputs:

```typescript
.input(z.object({
  email: z.string().email(),
  age: z.number().min(0).max(120),
}))
```

### 2. Router Organization
Structure routers by feature/domain rather than one monolithic router. Each feature should have its own router file.

### 3. Middleware Implementation
Implement middleware for authentication, logging, and cross-cutting concerns:

```typescript
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { user: ctx.user } });
});
```

### 4. Error Handling
Use TRPCError for consistent, informative error responses:

```typescript
import { TRPCError } from '@trpc/server';

throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'User not found',
});
```

### 5. Data Transformers
Apply SuperJSON for automatic serialization of dates, Maps, Sets, and other JavaScript types:

```typescript
import superjson from 'superjson';

const t = initTRPC.create({
  transformer: superjson,
});
```

### 6. React Query Integration
Leverage tRPC's built-in React Query utilities for data fetching, mutations, and caching:

```typescript
// Queries
const { data, isLoading } = trpc.user.getById.useQuery({ id: '123' });

// Mutations
const mutation = trpc.user.update.useMutation({
  onSuccess: () => {
    utils.user.getById.invalidate();
  },
});

// Prefetching
await utils.user.getById.prefetch({ id: '123' });
```

### 7. Context Creation
Share resources (database connections, user sessions) across procedures via context:

```typescript
// server/context.ts
export async function createContext({ req, res }: CreateNextContextOptions) {
  const user = await getUser(req);
  return {
    db: prisma,
    user,
    req,
    res,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

### 8. Type Exports
Export only type signatures to client code, never router implementations:

```typescript
// Only export the type
export type AppRouter = typeof appRouter;

// Never export the actual router to client code
```

### 9. Authorization Levels
Create distinct procedure types for different authorization levels:

```typescript
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(isAuthed).use(isAdmin);
```

### 10. Performance Optimization
- Enable request batching with httpBatchLink
- Configure maxURLLength to prevent URL length issues
- Implement prefetching for static/predictable data
- Use React Query's caching strategies

## Anti-Patterns to Avoid

- Do not use `any` types - leverage tRPC's full type inference
- Do not skip input validation
- Do not expose internal errors to clients
- Do not mix server and client code
- Do not create overly large routers - split by feature
