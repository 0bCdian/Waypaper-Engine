---
name: drizzle-orm
description: Guidelines for developing with Drizzle ORM, a lightweight type-safe TypeScript ORM with SQL-like syntax
---

# Drizzle ORM Development Guidelines

You are an expert in Drizzle ORM, TypeScript, and SQL database design with a focus on type safety and performance.

## Core Principles

- Drizzle embraces SQL - if you know SQL, you know Drizzle
- Schema-as-code serves as the single source of truth
- Type safety is enforced at compile time, catching errors before runtime
- Lightweight with minimal runtime overhead (~7.4kb min+gzip)
- Serverless-ready: works with Node.js, Bun, Deno, Cloudflare Workers

## Schema Design

### Basic Table Definition

```typescript
import { pgTable, serial, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: text("name"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  authorId: integer("author_id").references(() => users.id),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### Schema Organization

You can organize schemas in multiple ways:

```typescript
// Option 1: Single schema.ts file (recommended for smaller projects)
// src/db/schema.ts

// Option 2: Split by domain (recommended for larger projects)
// src/db/schema/users.ts
// src/db/schema/posts.ts
// src/db/schema/index.ts (re-exports all)
```

### Naming Conventions

Use the `casing` option for automatic camelCase to snake_case mapping:

```typescript
import { drizzle } from "drizzle-orm/node-postgres";

const db = drizzle(pool, {
  casing: "snake_case", // Automatically maps camelCase to snake_case
});
```

### Defining Relations

```typescript
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
```

### Adding Indexes

```typescript
import { pgTable, serial, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
  },
  (table) => [
    uniqueIndex("email_idx").on(table.email),
    index("name_idx").on(table.name),
  ]
);
```

## Database Connection

### PostgreSQL with node-postgres

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

### SQLite with better-sqlite3

```typescript
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

const sqlite = new Database("sqlite.db");
export const db = drizzle(sqlite, { schema });
```

### Turso/LibSQL

```typescript
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

## Query Patterns

### Select Queries

```typescript
// Select all columns
const allUsers = await db.select().from(users);

// Select specific columns
const userEmails = await db.select({ email: users.email }).from(users);

// With conditions
import { eq, and, or, gt, like } from "drizzle-orm";

const activeUsers = await db
  .select()
  .from(users)
  .where(eq(users.isActive, true));

const filteredUsers = await db
  .select()
  .from(users)
  .where(
    and(
      eq(users.isActive, true),
      like(users.email, "%@example.com")
    )
  );
```

### Relational Queries

```typescript
// Query with relations (requires schema with relations defined)
const usersWithPosts = await db.query.users.findMany({
  with: {
    posts: true,
  },
});

// Nested relations
const postsWithAuthor = await db.query.posts.findMany({
  with: {
    author: {
      columns: {
        id: true,
        name: true,
      },
    },
  },
});
```

### Insert Operations

```typescript
// Single insert
const newUser = await db
  .insert(users)
  .values({
    email: "user@example.com",
    name: "John Doe",
  })
  .returning();

// Bulk insert
await db.insert(users).values([
  { email: "user1@example.com", name: "User 1" },
  { email: "user2@example.com", name: "User 2" },
]);

// Upsert (insert or update on conflict)
await db
  .insert(users)
  .values({ email: "user@example.com", name: "John" })
  .onConflictDoUpdate({
    target: users.email,
    set: { name: "John Updated" },
  });
```

### Update Operations

```typescript
await db
  .update(users)
  .set({ name: "Jane Doe", updatedAt: new Date() })
  .where(eq(users.id, 1));
```

### Delete Operations

```typescript
await db.delete(users).where(eq(users.id, 1));
```

### Transactions

```typescript
await db.transaction(async (tx) => {
  const [user] = await tx
    .insert(users)
    .values({ email: "user@example.com", name: "User" })
    .returning();

  await tx.insert(posts).values({
    title: "First Post",
    authorId: user.id,
  });
});
```

## Migrations

### Generate Migrations

```bash
# Generate migration based on schema changes
npx drizzle-kit generate

# Apply migrations to database
npx drizzle-kit migrate

# Push schema directly (development only)
npx drizzle-kit push
```

### Migration Configuration

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Type Safety Best Practices

### Infer Types from Schema

```typescript
import { InferSelectModel, InferInsertModel } from "drizzle-orm";

// Infer types from table definitions
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// Use in application code
function createUser(data: NewUser): Promise<User> {
  return db.insert(users).values(data).returning().then((r) => r[0]);
}
```

### Strict TypeScript Configuration

Ensure strict mode is enabled in tsconfig.json:

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true
  }
}
```

## Performance Best Practices

### Use Indexes Appropriately

Always add indexes for columns used in WHERE clauses and JOINs:

```typescript
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("user_id_idx").on(table.userId),
    index("status_idx").on(table.status),
    index("created_at_idx").on(table.createdAt),
  ]
);
```

### Select Only Needed Columns

```typescript
// Bad: Fetches all columns
const users = await db.select().from(users);

// Good: Fetches only needed columns
const userNames = await db
  .select({ id: users.id, name: users.name })
  .from(users);
```

### Use Proper Pagination

```typescript
const page = 1;
const pageSize = 20;

const paginatedUsers = await db
  .select()
  .from(users)
  .limit(pageSize)
  .offset((page - 1) * pageSize)
  .orderBy(users.createdAt);
```

### Avoid N+1 Queries

```typescript
// Bad: N+1 query pattern
const users = await db.select().from(users);
for (const user of users) {
  const posts = await db.select().from(posts).where(eq(posts.authorId, user.id));
}

// Good: Use relational queries or joins
const usersWithPosts = await db.query.users.findMany({
  with: { posts: true },
});
```

## Common Mistakes to Avoid

1. **Not defining indexes** - Always add indexes for frequently queried columns
2. **Fetching too much data** - Select only the columns you need
3. **Missing foreign key constraints** - Define proper relationships in schema
4. **Manual migration modifications** - Let drizzle-kit manage migration history
5. **Not using transactions** - Wrap related operations in transactions for data integrity
