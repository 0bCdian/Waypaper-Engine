---
name: vercel-development
description: Vercel and Next.js deployment best practices including server components, edge functions, AI SDK integration, and performance optimization.
---

# Vercel Development Best Practices

## Overview

This skill provides comprehensive guidelines for developing and deploying applications on Vercel, with a focus on Next.js, React Server Components, Edge Functions, and the Vercel AI SDK.

## Core Principles

- Write concise, technical TypeScript code with accurate examples
- Use functional and declarative programming patterns; avoid classes
- Minimize 'use client', 'useEffect', and 'setState'; favor React Server Components (RSC)
- Implement responsive design with Tailwind CSS using mobile-first approach
- Optimize for Core Web Vitals and performance

## Project Structure

```
my-app/
├── app/                    # App Router pages and layouts
│   ├── (auth)/            # Route groups
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # UI primitives
│   └── features/         # Feature components
├── lib/                   # Utility functions
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript types
├── public/               # Static assets
└── vercel.json           # Vercel configuration
```

## Next.js App Router Guidelines

### File Naming Conventions
- Use lowercase with dashes for directories (e.g., `components/auth-wizard`)
- Prefer named exports for components and functions
- Use `page.tsx` for route pages, `layout.tsx` for layouts
- Use `loading.tsx` for loading states, `error.tsx` for error boundaries

### Server Components (Default)
```typescript
// app/users/page.tsx
import { getUsers } from '@/lib/data';

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <main>
      <h1>Users</h1>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </main>
  );
}
```

### Client Components (When Needed)
```typescript
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}
```

## TypeScript Standards

### Type Definitions
```typescript
// Use interfaces over types for object shapes
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// Use types for unions and complex types
type Status = 'pending' | 'active' | 'inactive';

// Avoid enums; use const objects instead
const STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

type StatusValue = typeof STATUS[keyof typeof STATUS];
```

### Component Props
```typescript
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
}: ButtonProps) {
  // Implementation
}
```

## API Routes

### Route Handlers
```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function GET(request: NextRequest) {
  const users = await getUsers();
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateUserSchema.parse(body);

    const user = await createUser(validated);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Edge Runtime
```typescript
// app/api/edge-function/route.ts
export const runtime = 'edge';

export async function GET(request: Request) {
  return new Response(JSON.stringify({ message: 'Hello from the edge!' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## Vercel AI SDK Integration

### Streaming Chat UI
```typescript
'use client';

import { useChat } from 'ai/react';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {messages.map(message => (
          <div key={message.id} className={message.role === 'user' ? 'text-right' : ''}>
            <p>{message.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          disabled={isLoading}
        />
      </form>
    </div>
  );
}
```

### AI API Route
```typescript
// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(request: Request) {
  const { messages } = await request.json();

  const result = await streamText({
    model: openai('gpt-4-turbo'),
    messages,
    system: 'You are a helpful assistant.',
  });

  return result.toDataStreamResponse();
}
```

### Error Handling for AI
```typescript
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    const result = await streamText({
      model: openai('gpt-4-turbo'),
      messages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    // Handle rate limiting
    if (error.message?.includes('rate limit')) {
      return new Response('Rate limit exceeded. Please try again later.', {
        status: 429,
      });
    }

    // Handle quota exceeded
    if (error.message?.includes('quota')) {
      return new Response('API quota exceeded.', { status: 402 });
    }

    // Fallback to alternative model
    console.error('Primary model failed:', error);
    return new Response('Service temporarily unavailable.', { status: 503 });
  }
}
```

## Data Fetching

### Server-Side Data Fetching
```typescript
// Fetch data in Server Components
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!res.ok) {
    throw new Error('Failed to fetch data');
  }

  return res.json();
}

export default async function Page() {
  const data = await getData();
  return <div>{/* Render data */}</div>;
}
```

### URL State Management
```typescript
// Use URL query parameters for server state
import { useSearchParams, useRouter } from 'next/navigation';

export function Filters() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    router.push(`?${params.toString()}`);
  };

  return (/* Filter UI */);
}
```

## Performance Optimization

### Image Optimization
```typescript
import Image from 'next/image';

export function Hero() {
  return (
    <Image
      src="/hero.jpg"
      alt="Hero image"
      width={1200}
      height={600}
      priority // Load immediately for LCP
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,..."
    />
  );
}
```

### Dynamic Imports
```typescript
import dynamic from 'next/dynamic';

// Lazy load heavy components
const HeavyChart = dynamic(() => import('@/components/heavy-chart'), {
  loading: () => <div>Loading chart...</div>,
  ssr: false, // Disable SSR if needed
});
```

### Suspense Boundaries
```typescript
import { Suspense } from 'react';

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<Loading />}>
        <AsyncComponent />
      </Suspense>
    </div>
  );
}
```

## Error Handling

### Error Boundaries
```typescript
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### Global Error Handler
```typescript
// app/global-error.tsx
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
```

## Vercel Configuration

### vercel.json
```json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 0 * * *"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" }
      ]
    }
  ]
}
```

### Environment Variables
```typescript
// Use environment variables for sensitive data
const apiKey = process.env.API_KEY;
const publicUrl = process.env.NEXT_PUBLIC_APP_URL;

// Validate required env vars
if (!apiKey) {
  throw new Error('API_KEY environment variable is required');
}
```

## Deployment

### Preview Deployments
- Every pull request gets a preview deployment
- Use preview URLs for testing and review
- Share preview links with stakeholders

### Production Deployment
```bash
# Connect repo to Vercel (one-click from GitHub)
# Or use Vercel CLI
vercel --prod
```

### Edge Config
```typescript
import { get } from '@vercel/edge-config';

export async function getFeatureFlag(flag: string) {
  const flags = await get('featureFlags');
  return flags?.[flag] ?? false;
}
```

## UI and Styling

### Tailwind CSS Setup
```typescript
// Use mobile-first responsive design
export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 md:p-6 lg:p-8 rounded-lg bg-white shadow-sm">
      {children}
    </div>
  );
}
```

### Shadcn UI Components
```typescript
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

export function ConfirmDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete</Button>
      </DialogTrigger>
      <DialogContent>
        <p>Are you sure?</p>
      </DialogContent>
    </Dialog>
  );
}
```

## Accessibility

### Best Practices
```typescript
export function AccessibleButton() {
  return (
    <button
      aria-label="Close dialog"
      aria-expanded={isOpen}
      aria-controls="dialog-content"
      className="focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
    >
      <XIcon aria-hidden="true" />
    </button>
  );
}
```

## Common Pitfalls to Avoid

1. Using 'use client' unnecessarily
2. Not implementing proper error boundaries
3. Ignoring Core Web Vitals optimization
4. Not using TypeScript strictly
5. Hardcoding environment variables
6. Missing Suspense boundaries for async components
7. Not optimizing images
8. Ignoring accessibility requirements
