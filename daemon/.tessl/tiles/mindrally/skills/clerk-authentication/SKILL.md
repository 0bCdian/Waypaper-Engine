---
name: clerk-authentication
description: Guidelines for implementing Clerk authentication in Next.js applications with middleware, hooks, and security best practices
---

# Clerk Authentication

You are an expert in Clerk authentication implementation for Next.js applications. Follow these guidelines when integrating Clerk.

## Core Principles

- Implement defense-in-depth with multiple authentication layers
- Verify authentication at every data access point, not just middleware
- Protect server actions individually
- Use Clerk's built-in security features (HttpOnly cookies, CSRF protection)

## Installation and Setup

```bash
npm install @clerk/nextjs
```

### Environment Variables

```bash
# Required
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Optional: Custom URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

## Provider Setup

### App Router (app/layout.tsx)

```typescript
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

### With Custom Appearance

```typescript
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#3b82f6',
        },
        elements: {
          formButtonPrimary: 'bg-blue-500 hover:bg-blue-600',
        },
      }}
    >
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

## Middleware Configuration

### Basic Middleware (middleware.ts)

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define protected routes
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/protected(.*)',
  '/settings(.*)',
]);

// Define public routes (optional, for clarity)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/public(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
```

### Advanced Middleware with Role-Based Access

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/api/protected(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  // Admin routes require admin role
  if (isAdminRoute(req)) {
    if (!userId || sessionClaims?.metadata?.role !== 'admin') {
      return new Response('Forbidden', { status: 403 });
    }
  }

  // Protected routes require authentication
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});
```

## Authentication in Server Components

### Using auth()

```typescript
import { auth } from '@clerk/nextjs/server';

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Fetch user-specific data
  const data = await fetchUserData(userId);

  return <Dashboard data={data} />;
}
```

### Using currentUser()

```typescript
import { currentUser } from '@clerk/nextjs/server';

export default async function ProfilePage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div>
      <h1>Welcome, {user.firstName}!</h1>
      <p>Email: {user.emailAddresses[0]?.emailAddress}</p>
    </div>
  );
}
```

## Authentication in Client Components

### useUser Hook

```typescript
'use client';

import { useUser } from '@clerk/nextjs';

export function UserProfile() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return <Skeleton />;
  }

  if (!isSignedIn) {
    return <SignInPrompt />;
  }

  return (
    <div>
      <img src={user.imageUrl} alt={user.fullName ?? 'User'} />
      <p>{user.fullName}</p>
    </div>
  );
}
```

### useAuth Hook

```typescript
'use client';

import { useAuth } from '@clerk/nextjs';

export function ProtectedAction() {
  const { isLoaded, userId, getToken } = useAuth();

  async function handleAction() {
    if (!userId) return;

    // Get a fresh token for API calls
    const token = await getToken();

    const response = await fetch('/api/protected', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  if (!isLoaded || !userId) {
    return null;
  }

  return <button onClick={handleAction}>Perform Action</button>;
}
```

## Server Actions Protection

Always protect server actions individually:

```typescript
'use server';

import { auth } from '@clerk/nextjs/server';

export async function createPost(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  // Create post with user ID
  const post = await db.post.create({
    data: {
      title,
      content,
      authorId: userId,
    },
  });

  revalidatePath('/posts');
  return post;
}
```

### With Role Validation

```typescript
'use server';

import { auth } from '@clerk/nextjs/server';

export async function deleteUser(userId: string) {
  const { userId: currentUserId, sessionClaims } = await auth();

  if (!currentUserId) {
    throw new Error('Unauthorized');
  }

  if (sessionClaims?.metadata?.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }

  await db.user.delete({ where: { id: userId } });
  revalidatePath('/admin/users');
}
```

## API Route Protection

### Route Handlers (App Router)

```typescript
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await fetchUserData(userId);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  // Process request...

  return NextResponse.json({ success: true });
}
```

## JWT Verification for External APIs

```typescript
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  const { getToken } = await auth();

  // Get JWT for external API
  const token = await getToken({ template: 'external-api' });

  const response = await fetch('https://external-api.com/data', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return Response.json(await response.json());
}
```

## Organization Support

```typescript
import { auth } from '@clerk/nextjs/server';

export async function getOrganizationData() {
  const { userId, orgId, orgRole } = await auth();

  if (!userId || !orgId) {
    throw new Error('Must be in an organization');
  }

  // Check organization role
  if (orgRole !== 'org:admin') {
    throw new Error('Admin access required');
  }

  return await db.organization.findUnique({
    where: { clerkOrgId: orgId },
  });
}
```

## Custom Session Claims

### Configure in Clerk Dashboard

Add custom claims via JWT Templates, then access them:

```typescript
import { auth } from '@clerk/nextjs/server';

export async function checkSubscription() {
  const { sessionClaims } = await auth();

  const plan = sessionClaims?.metadata?.subscriptionPlan;

  if (plan !== 'pro') {
    throw new Error('Pro subscription required');
  }
}
```

## UI Components

### Pre-built Components

```typescript
import {
  SignIn,
  SignUp,
  SignOutButton,
  UserButton,
  SignedIn,
  SignedOut,
} from '@clerk/nextjs';

export function Header() {
  return (
    <header>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal" />
      </SignedOut>
    </header>
  );
}

// Dedicated sign-in page
export default function SignInPage() {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <SignIn />
    </div>
  );
}
```

## Security Best Practices

### 1. Defense in Depth

```typescript
// Layer 1: Middleware
export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

// Layer 2: Server Component
export default async function Page() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  // ...
}

// Layer 3: Data Access
async function fetchUserData(userId: string) {
  const { userId: currentUserId } = await auth();
  if (currentUserId !== userId) throw new Error('Forbidden');
  // ...
}
```

### 2. Protect All Server Actions

```typescript
// Every server action should verify auth independently
'use server';

export async function sensitiveAction() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  // ...
}
```

### 3. Avoid Client-Side Only Protection

```typescript
// BAD: Client-side only check
'use client';
export function SecretComponent() {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return null;
  return <div>Secret Data</div>; // Data still sent to client!
}

// GOOD: Server-side protection
export default async function SecretPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const data = await fetchSecretData(userId);
  return <SecretComponent data={data} />;
}
```

## Error Handling

```typescript
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  try {
    const { userId } = await auth();

    if (!userId) {
      redirect('/sign-in');
    }

    const data = await fetchUserData(userId);
    return <Dashboard data={data} />;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect('/sign-in');
    }
    throw error;
  }
}
```

## Testing

```typescript
// Mock Clerk for testing
import { auth } from '@clerk/nextjs/server';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('Protected API', () => {
  it('returns 401 for unauthenticated requests', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: null });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns data for authenticated requests', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: 'user_123' });

    const response = await GET();
    expect(response.status).toBe(200);
  });
});
```

## Common Anti-Patterns to Avoid

1. Relying solely on middleware for protection
2. Not protecting server actions individually
3. Using client-side auth checks for sensitive data
4. Exposing user data without ownership verification
5. Not validating organization membership for org-scoped resources
6. Hardcoding role checks instead of using Clerk's RBAC
7. Not handling loading states in client components
