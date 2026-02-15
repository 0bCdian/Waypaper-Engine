---
name: netlify-development
description: Netlify development best practices for serverless functions, edge functions, Blobs storage, build configuration, and deployment workflows.
---

# Netlify Development Best Practices

## Overview

This skill provides comprehensive guidelines for building and deploying projects on Netlify, covering serverless functions, edge functions, background functions, scheduled functions, Netlify Blobs, Image CDN, and deployment configuration.

## Core Principles

- Use in-code configuration via exported `config` objects (preferred over netlify.toml)
- Never add version numbers to imported Netlify packages
- Only add CORS headers when explicitly required
- Leverage appropriate function types for different use cases
- Use Netlify Blobs for state and data storage

## Function Types Overview

| Type | Use Case | Timeout | Path Convention |
|------|----------|---------|-----------------|
| Serverless | Standard API endpoints | 10s (26s Pro) | `/.netlify/functions/name` |
| Edge | Request/response modification | 50ms CPU | Custom paths |
| Background | Long-running async tasks | 15 minutes | `-background` suffix |
| Scheduled | Cron-based tasks | 10s (26s Pro) | Configured schedule |

## Serverless Functions

### Basic Structure
```typescript
// netlify/functions/hello.mts
import type { Context } from '@netlify/functions';

export default async (request: Request, context: Context) => {
  try {
    // Validate request
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const body = await request.json();

    // Business logic
    const result = await processData(body);

    return Response.json(result);
  } catch (error) {
    console.error('Function error:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};

export const config = {
  path: '/api/hello',
};
```

### Configuration Options
```typescript
export const config = {
  // Custom path (instead of /.netlify/functions/name)
  path: '/api/users',

  // HTTP methods (optional, allows all by default)
  method: ['GET', 'POST'],

  // Rate limiting
  rateLimit: {
    windowSize: 60,
    windowLimit: 100,
  },
};
```

### Path Conventions
- Default path: `/.netlify/functions/{function_name}`
- Custom paths via config completely replace the default
- Use custom paths for cleaner API URLs

## Edge Functions

### Use Cases
- Modify requests before they reach the origin
- Modify responses before returning to users
- Geolocation-based personalization
- A/B testing
- Authentication at the edge

### Implementation
```typescript
// netlify/edge-functions/geo-redirect.ts
import type { Context } from '@netlify/edge-functions';

export default async (request: Request, context: Context) => {
  const country = context.geo.country?.code || 'US';

  // Redirect based on country
  if (country === 'DE') {
    return Response.redirect(new URL('/de', request.url));
  }

  // Continue to origin
  return context.next();
};

export const config = {
  path: '/*',
  excludedPath: ['/api/*', '/_next/*'],
};
```

### Response Modification
```typescript
export default async (request: Request, context: Context) => {
  // Get response from origin
  const response = await context.next();

  // Modify headers
  response.headers.set('X-Custom-Header', 'value');

  // Transform HTML
  const html = await response.text();
  const modifiedHtml = html.replace('</body>', '<script>...</script></body>');

  return new Response(modifiedHtml, {
    status: response.status,
    headers: response.headers,
  });
};
```

## Background Functions

### Key Characteristics
- 15-minute timeout (wall clock time)
- Immediately return 202 status code
- Return values are ignored
- Must have `-background` suffix

### Implementation
```typescript
// netlify/functions/process-video-background.mts
import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

export default async (request: Request, context: Context) => {
  const { videoId } = await request.json();

  // Long-running processing
  const result = await processVideo(videoId);

  // Store result for later retrieval
  const store = getStore('processed-videos');
  await store.setJSON(videoId, result);

  // Return value is ignored
  return new Response('Processing complete');
};

export const config = {
  path: '/api/process-video',
};
```

### Retrieving Background Results
```typescript
// netlify/functions/get-video-status.mts
import { getStore } from '@netlify/blobs';

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const videoId = url.searchParams.get('id');

  const store = getStore('processed-videos');
  const result = await store.get(videoId, { type: 'json' });

  if (!result) {
    return Response.json({ status: 'processing' });
  }

  return Response.json({ status: 'complete', data: result });
};
```

## Scheduled Functions

### Configuration
```typescript
// netlify/functions/daily-cleanup.mts
import type { Context } from '@netlify/functions';

export default async (request: Request, context: Context) => {
  console.log('Running daily cleanup...');

  // Cleanup logic
  await cleanupOldRecords();

  return new Response('Cleanup complete');
};

export const config = {
  schedule: '@daily', // or '0 0 * * *' for midnight UTC
};
```

### Schedule Patterns
```typescript
// Common patterns
export const config = {
  schedule: '@hourly',     // Every hour
  schedule: '@daily',      // Every day at midnight
  schedule: '@weekly',     // Every week
  schedule: '*/15 * * * *', // Every 15 minutes
  schedule: '0 9 * * 1-5',  // 9 AM on weekdays
};
```

## Netlify Blobs

### Basic Usage
```typescript
import { getStore } from '@netlify/blobs';

// Get a store
const store = getStore('my-store');

// Store data
await store.set('key', 'string value');
await store.setJSON('json-key', { foo: 'bar' });

// Retrieve data
const value = await store.get('key');
const jsonValue = await store.get('json-key', { type: 'json' });

// Delete data
await store.delete('key');

// List keys
const { blobs } = await store.list();
```

### Binary Data
```typescript
import { getStore } from '@netlify/blobs';

const store = getStore('files');

// Store binary data
const arrayBuffer = await file.arrayBuffer();
await store.set('uploads/file.pdf', arrayBuffer, {
  metadata: { contentType: 'application/pdf' },
});

// Retrieve binary data
const blob = await store.get('uploads/file.pdf', { type: 'blob' });
```

### Deploy-specific vs Site-wide
```typescript
// Site-wide store (persists across deploys)
const siteStore = getStore({
  name: 'user-data',
  siteID: context.site.id,
});

// Deploy-specific store (scoped to deployment)
const deployStore = getStore({
  name: 'cache',
  deployID: context.deploy.id,
});
```

## Netlify Image CDN

### Usage
```html
<!-- Basic optimization -->
<img src="/.netlify/images?url=/images/hero.jpg&w=800&q=80" alt="Hero">

<!-- With fit and format -->
<img src="/.netlify/images?url=/images/hero.jpg&w=400&h=300&fit=cover&fm=webp" alt="Hero">
```

### Parameters
- `url`: Source image path (required)
- `w`: Width in pixels
- `h`: Height in pixels
- `q`: Quality (1-100)
- `fit`: cover, contain, fill
- `fm`: Format (webp, avif, auto)

### Programmatic Usage
```typescript
function getOptimizedImageUrl(src: string, options: ImageOptions) {
  const params = new URLSearchParams({
    url: src,
    w: String(options.width),
    q: String(options.quality || 80),
    fm: 'auto',
  });

  return `/.netlify/images?${params}`;
}
```

## Environment Variables

### Access in Functions
```typescript
export default async (request: Request, context: Context) => {
  // Access environment variables
  const apiKey = Netlify.env.get('API_KEY');
  const dbUrl = process.env.DATABASE_URL;

  if (!apiKey) {
    console.error('API_KEY not configured');
    return Response.json({ error: 'Configuration error' }, { status: 500 });
  }

  // Use variables
};
```

### Context Variables
```typescript
export default async (request: Request, context: Context) => {
  // Available context
  const { site, deploy, geo, ip, requestId } = context;

  console.log('Site ID:', site.id);
  console.log('Deploy ID:', deploy.id);
  console.log('Country:', geo.country?.code);
  console.log('Request ID:', requestId);
};
```

## Build Configuration

### netlify.toml
```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"

[functions]
  node_bundler = "esbuild"

[dev]
  command = "npm run dev"
  port = 3000
  targetPort = 5173
```

## File-based Uploads

### Direct Upload to Functions
```typescript
// netlify/functions/upload.mts
import { getStore } from '@netlify/blobs';

export default async (request: Request, context: Context) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  const store = getStore('uploads');
  const key = `${Date.now()}-${file.name}`;

  await store.set(key, await file.arrayBuffer(), {
    metadata: {
      contentType: file.type,
      originalName: file.name,
    },
  });

  return Response.json({ key, message: 'Upload successful' });
};
```

## Site Management

### Creating and Linking Sites
```bash
# Initialize new site
netlify init

# Link existing site
netlify link

# Deploy manually
netlify deploy

# Deploy to production
netlify deploy --prod
```

## Local Development

### Netlify Dev
```bash
# Start local development server
netlify dev

# With specific port
netlify dev --port 8888

# With live reload
netlify dev --live
```

### Testing Functions Locally
```bash
# Invoke function directly
netlify functions:invoke hello --payload '{"name": "World"}'

# Serve functions only
netlify functions:serve
```

## Error Handling Best Practices

### Structured Error Responses
```typescript
interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

function errorResponse(status: number, error: ErrorResponse): Response {
  return Response.json(error, { status });
}

export default async (request: Request, context: Context) => {
  try {
    // Validation
    const body = await request.json();
    if (!body.email) {
      return errorResponse(400, {
        error: 'Email is required',
        code: 'MISSING_EMAIL',
      });
    }

    // Business logic
    const result = await processRequest(body);
    return Response.json(result);

  } catch (error) {
    console.error('Function error:', error);
    return errorResponse(500, {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};
```

## Security Guidelines

### Input Validation
```typescript
import { z } from 'zod';

const RequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

export default async (request: Request, context: Context) => {
  const body = await request.json();

  const result = RequestSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: 'Validation failed', details: result.error.issues },
      { status: 400 }
    );
  }

  // Use validated data
  const { email, name } = result.data;
};
```

### Authentication
```typescript
async function verifyToken(request: Request): Promise<User | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return null;
  }

  const token = auth.slice(7);
  // Verify token logic
  return verifyJWT(token);
}

export default async (request: Request, context: Context) => {
  const user = await verifyToken(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Authenticated request handling
};
```

## Common Pitfalls to Avoid

1. Adding version numbers to `@netlify/functions` imports
2. Adding CORS headers when not explicitly needed
3. Using wrong function type for the use case
4. Forgetting `-background` suffix for background functions
5. Not using Blobs for persistent storage in background functions
6. Ignoring the 15-minute timeout for background functions
7. Not validating input in serverless functions
8. Hardcoding environment variables
9. Not handling errors appropriately at the edge
10. Using serverless functions for tasks better suited to edge functions
