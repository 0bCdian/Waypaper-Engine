---
name: convex
description: Guidelines for developing with Convex backend-as-a-service platform, covering queries, mutations, actions, and real-time data patterns
---

# Convex Development Guidelines

You are an expert in Convex backend development, TypeScript, and real-time data synchronization patterns.

## General Development Specifications

### Code Style and Structure

- Write concise TypeScript using functional declarations, iterators, and modules
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError)
- Structure code with exported components, subcomponents, helpers, and static types
- Use dash-case for directories with named exports
- Prefer interfaces over types; avoid enums in favor of union types
- Use functional components with declarative JSX patterns

### Error Handling

- Handle errors early in functions with guard clauses
- Log errors appropriately for debugging
- Provide user-friendly error messages
- Use Zod for form validation
- Implement proper error boundaries in React components

### UI Framework Integration

- Use Shadcn UI and Radix UI for component primitives
- Style with Tailwind CSS using responsive, mobile-first design
- Minimize useClient, useEffect, and useState usage
- Leverage React Server Components where applicable
- Use Suspense for loading states and dynamic loading for code splitting

## Convex-Specific Patterns

### Queries

Structure queries using the `query` constructor:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getItems = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ctx provides: db, storage, auth
    const identity = await ctx.auth.getUserIdentity();

    if (args.status) {
      return await ctx.db
        .query("items")
        .withIndex("by_status", (q) => q.eq("status", args.status))
        .collect();
    }

    return await ctx.db.query("items").collect();
  },
});
```

**Important**: Prefer Convex indexes over filters for better performance. Define indexes in schema.ts using the `.index()` method, then query with `.withIndex()`.

### Mutations

Structure mutations for database writes:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createItem = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("items", {
      title: args.title,
      description: args.description,
      userId: identity.subject,
      createdAt: Date.now(),
    });
  },
});
```

### Actions

Use actions for external API calls and side effects:

```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";

export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    // Actions can call external APIs
    const response = await fetch("https://api.email-service.com/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });

    return response.ok;
  },
});
```

### Schema Definition with Indexes

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  items: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    userId: v.string(),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"]),
});
```

### HTTP Router

Define HTTP routes for webhooks and external integrations:

```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    // Process webhook
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
```

### Scheduled Jobs

Implement cron jobs for recurring tasks:

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every hour
crons.interval(
  "cleanup-old-items",
  { hours: 1 },
  internal.tasks.cleanupOldItems
);

// Run at specific time (daily at midnight UTC)
crons.monthly(
  "monthly-report",
  { day: 1, hourUTC: 0, minuteUTC: 0 },
  internal.reports.generateMonthlyReport
);

export default crons;
```

### File Handling

Three-step process for file uploads:

```typescript
// 1. Generate upload URL (mutation)
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// 2. Client POSTs file to the URL
// const uploadUrl = await generateUploadUrl();
// const response = await fetch(uploadUrl, { method: "POST", body: file });
// const { storageId } = await response.json();

// 3. Save storage ID to database (mutation)
export const saveFile = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("files", {
      storageId: args.storageId,
      filename: args.filename,
    });
  },
});
```

## Best Practices

1. **Always use indexes** for queries that filter or sort data
2. **Validate arguments** using Convex validators (`v.string()`, `v.number()`, etc.)
3. **Check authentication** early in handlers that require it
4. **Use internal functions** for operations that should not be exposed to clients
5. **Leverage real-time subscriptions** - Convex queries automatically update when data changes
6. **Keep mutations small** and focused on single operations
7. **Use actions for side effects** - never call external APIs from queries or mutations
8. **Handle errors gracefully** with proper error messages for users

## Performance Considerations

- Use `.withIndex()` instead of `.filter()` whenever possible
- Paginate large result sets using `.paginate()`
- Use `.first()` instead of `.collect()` when expecting a single result
- Consider data denormalization for frequently accessed data
- Use Convex's built-in caching - avoid implementing your own
