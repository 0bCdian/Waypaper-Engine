---
name: cloudflare-development
description: Cloudflare Workers, Pages, KV, D1, R2, and Durable Objects development best practices for edge computing applications.
---

# Cloudflare Development Best Practices

## Overview

This skill provides comprehensive guidelines for developing applications on Cloudflare's edge platform, including Workers, Pages, KV storage, D1 databases, R2 object storage, and Durable Objects.

## Core Principles

- Write lightweight, fast code optimized for edge execution
- Minimize cold start times and execution duration
- Use appropriate storage solutions for each use case
- Follow security best practices for edge computing
- Leverage Cloudflare's global network for performance

## Cloudflare Workers Guidelines

### Basic Worker Structure
```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Route handling
      if (url.pathname === '/api/data') {
        return handleApiRequest(request, env);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
```

### Environment Types
```typescript
interface Env {
  // KV Namespaces
  MY_KV: KVNamespace;

  // D1 Databases
  MY_DB: D1Database;

  // R2 Buckets
  MY_BUCKET: R2Bucket;

  // Durable Objects
  MY_DURABLE_OBJECT: DurableObjectNamespace;

  // Environment Variables
  API_KEY: string;
}
```

### Best Practices
- Use TypeScript for type safety
- Handle errors at the edge appropriately
- Implement proper request validation
- Use `ctx.waitUntil()` for background tasks
- Minimize external API calls when possible

## Wrangler Configuration

### wrangler.toml Structure
```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

[[kv_namespaces]]
binding = "MY_KV"
id = "abc123"

[[d1_databases]]
binding = "MY_DB"
database_name = "my-database"
database_id = "def456"

[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "my-bucket"

[durable_objects]
bindings = [
  { name = "MY_DURABLE_OBJECT", class_name = "MyDurableObject" }
]

[[migrations]]
tag = "v1"
new_classes = ["MyDurableObject"]
```

## KV Storage Guidelines

### Usage Patterns
```typescript
// Writing to KV
await env.MY_KV.put('key', JSON.stringify(data), {
  expirationTtl: 3600, // 1 hour
  metadata: { version: '1.0' },
});

// Reading from KV
const value = await env.MY_KV.get('key', { type: 'json' });

// Listing keys
const list = await env.MY_KV.list({ prefix: 'user:' });
```

### Best Practices
- Use KV for read-heavy workloads with eventual consistency
- Set appropriate TTLs for cached data
- Use metadata for additional key information
- Implement cache invalidation strategies
- Be aware of KV's eventual consistency model

## D1 Database Guidelines

### Query Patterns
```typescript
// Parameterized queries (prevent SQL injection)
const results = await env.MY_DB
  .prepare('SELECT * FROM users WHERE id = ?')
  .bind(userId)
  .all();

// Batch operations
const batch = await env.MY_DB.batch([
  env.MY_DB.prepare('INSERT INTO logs (message) VALUES (?)').bind('log1'),
  env.MY_DB.prepare('INSERT INTO logs (message) VALUES (?)').bind('log2'),
]);

// First result only
const user = await env.MY_DB
  .prepare('SELECT * FROM users WHERE email = ?')
  .bind(email)
  .first();
```

### Schema Management
```sql
-- migrations/0001_initial.sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

### Best Practices
- Always use parameterized queries
- Create appropriate indexes
- Use batch operations for multiple writes
- Keep queries simple and efficient
- Use migrations for schema changes

## R2 Object Storage Guidelines

### Usage Patterns
```typescript
// Upload object
await env.MY_BUCKET.put('uploads/file.pdf', fileData, {
  httpMetadata: {
    contentType: 'application/pdf',
  },
  customMetadata: {
    uploadedBy: userId,
  },
});

// Download object
const object = await env.MY_BUCKET.get('uploads/file.pdf');
if (object) {
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
    },
  });
}

// List objects
const list = await env.MY_BUCKET.list({ prefix: 'uploads/' });

// Delete object
await env.MY_BUCKET.delete('uploads/file.pdf');
```

### Best Practices
- Set appropriate content types
- Use multipart uploads for large files
- Implement proper access controls
- Use presigned URLs for direct client uploads
- Organize objects with logical prefixes

## Durable Objects Guidelines

### Implementation
```typescript
export class ChatRoom implements DurableObject {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, { id: string }>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.sessions = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/websocket') {
      const pair = new WebSocketPair();
      await this.handleSession(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    return new Response('Not Found', { status: 404 });
  }

  async handleSession(webSocket: WebSocket) {
    webSocket.accept();

    webSocket.addEventListener('message', async (event) => {
      // Handle messages
    });

    webSocket.addEventListener('close', () => {
      this.sessions.delete(webSocket);
    });
  }
}
```

### Best Practices
- Use for coordination and stateful logic
- Implement proper WebSocket handling
- Use storage API for persistence
- Handle hibernation for cost optimization
- Design for single-point-of-coordination patterns

## Cloudflare Pages Guidelines

### Project Structure
```
my-pages-project/
├── public/           # Static assets
├── functions/        # Pages Functions
│   ├── api/
│   │   └── [endpoint].ts
│   └── _middleware.ts
├── src/              # Application source
└── wrangler.toml     # Configuration
```

### Pages Functions
```typescript
// functions/api/users.ts
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const users = await context.env.MY_DB
    .prepare('SELECT * FROM users')
    .all();

  return Response.json(users.results);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await context.request.json();
  // Handle POST
  return Response.json({ success: true });
};
```

## Edge Security Best Practices

### Request Validation
```typescript
function validateRequest(request: Request): boolean {
  // Check content type
  const contentType = request.headers.get('Content-Type');
  if (request.method === 'POST' && !contentType?.includes('application/json')) {
    return false;
  }

  // Check origin (CORS)
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return false;
  }

  return true;
}
```

### Authentication
```typescript
async function verifyAuth(request: Request, env: Env): Promise<boolean> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);
  // Verify JWT or API key
  return await verifyToken(token, env);
}
```

### Rate Limiting
```typescript
async function checkRateLimit(ip: string, env: Env): Promise<boolean> {
  const key = `ratelimit:${ip}`;
  const current = await env.MY_KV.get(key, { type: 'json' }) as number || 0;

  if (current >= 100) { // 100 requests per window
    return false;
  }

  await env.MY_KV.put(key, JSON.stringify(current + 1), {
    expirationTtl: 60, // 1 minute window
  });

  return true;
}
```

## Performance Optimization

### Caching Strategies
```typescript
// Cache API usage
const cache = caches.default;

async function handleRequest(request: Request): Promise<Response> {
  // Check cache
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  // Generate response
  const response = await generateResponse(request);

  // Cache response
  const cacheResponse = new Response(response.body, response);
  cacheResponse.headers.set('Cache-Control', 'public, max-age=3600');
  ctx.waitUntil(cache.put(request, cacheResponse.clone()));

  return cacheResponse;
}
```

### Background Processing
```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Respond immediately
    const response = Response.json({ status: 'accepted' });

    // Process in background
    ctx.waitUntil(processInBackground(request, env));

    return response;
  },
};
```

## Testing

### Local Development
```bash
# Start local development server
wrangler dev

# Run with local persistence
wrangler dev --persist

# Test with specific environment
wrangler dev --env staging
```

### Unit Testing
```typescript
import { unstable_dev } from 'wrangler';

describe('Worker', () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  test('returns 200 for valid request', async () => {
    const response = await worker.fetch('/api/health');
    expect(response.status).toBe(200);
  });
});
```

## Deployment

### Production Deployment
```bash
# Deploy to production
wrangler deploy

# Deploy to specific environment
wrangler deploy --env production

# Deploy with secrets
wrangler secret put API_KEY
```

### CI/CD Integration
```yaml
# .github/workflows/deploy.yml
name: Deploy Worker

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Common Pitfalls to Avoid

1. Not handling errors at the edge properly
2. Making too many external API calls
3. Ignoring Worker CPU and memory limits
4. Not using appropriate storage for use case
5. Forgetting eventual consistency in KV
6. Not implementing proper rate limiting
7. Hardcoding secrets in code
8. Ignoring cold start optimization
