---
name: remix
description: Expert guidance for Remix development with TypeScript, loaders/actions, nested routes, and full-stack web application best practices
---

# Remix Development

You are an expert in Remix, React, TypeScript, and full-stack web development.

## Key Principles

- Write concise, technical Remix code with accurate TypeScript examples
- Embrace progressive enhancement and web standards
- Use loaders for data fetching and actions for mutations
- Leverage nested routes for code organization
- Prioritize server-side rendering and web fundamentals

## Project Structure

```
app/
├── components/         # Reusable React components
├── models/             # Database models and types
├── routes/
│   ├── _index.tsx      # / route
│   ├── about.tsx       # /about route
│   └── posts/
│       ├── _index.tsx  # /posts route
│       └── $slug.tsx   # /posts/:slug route
├── styles/             # CSS files
├── utils/              # Utility functions
├── entry.client.tsx    # Client entry
├── entry.server.tsx    # Server entry
└── root.tsx            # Root layout
```

## Loaders

### Basic Loader
```typescript
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

export async function loader({ params }: LoaderFunctionArgs) {
  const post = await getPost(params.slug);

  if (!post) {
    throw new Response('Not Found', { status: 404 });
  }

  return json({ post });
}

export default function PostRoute() {
  const { post } = useLoaderData<typeof loader>();

  return <article>{post.content}</article>;
}
```

### Loader with Authentication
```typescript
import { redirect } from '@remix-run/node';
import { getUser } from '~/utils/session.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);

  if (!user) {
    throw redirect('/login');
  }

  return json({ user });
}
```

## Actions

### Form Handling
```typescript
import type { ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const title = formData.get('title');
  const content = formData.get('content');

  const errors: Record<string, string> = {};

  if (!title) {
    errors.title = 'Title is required';
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  const post = await createPost({ title, content });

  return redirect(`/posts/${post.slug}`);
}
```

### Using Action Data
```typescript
import { useActionData, Form } from '@remix-run/react';

export default function NewPost() {
  const actionData = useActionData<typeof action>();

  return (
    <Form method="post">
      <input name="title" type="text" />
      {actionData?.errors?.title && (
        <p className="error">{actionData.errors.title}</p>
      )}
      <textarea name="content" />
      <button type="submit">Create Post</button>
    </Form>
  );
}
```

## Nested Routes

### Layout Routes
```typescript
// routes/dashboard.tsx (layout)
import { Outlet } from '@remix-run/react';

export default function DashboardLayout() {
  return (
    <div className="dashboard">
      <nav>
        <Link to="/dashboard">Overview</Link>
        <Link to="/dashboard/settings">Settings</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

### Pathless Layouts
```typescript
// routes/_auth.tsx (pathless layout for /login, /register)
export default function AuthLayout() {
  return (
    <div className="auth-container">
      <Outlet />
    </div>
  );
}
```

## useFetcher

### Non-Navigation Fetches
```typescript
import { useFetcher } from '@remix-run/react';

export default function LikeButton({ postId }: { postId: string }) {
  const fetcher = useFetcher();
  const isLiking = fetcher.state !== 'idle';

  return (
    <fetcher.Form method="post" action="/api/like">
      <input type="hidden" name="postId" value={postId} />
      <button type="submit" disabled={isLiking}>
        {isLiking ? 'Liking...' : 'Like'}
      </button>
    </fetcher.Form>
  );
}
```

### Optimistic UI
```typescript
export default function TodoItem({ todo }: { todo: Todo }) {
  const fetcher = useFetcher();

  const isDeleting = fetcher.formData?.get('_action') === 'delete';

  if (isDeleting) {
    return null; // Optimistically remove
  }

  return (
    <li>
      {todo.title}
      <fetcher.Form method="post">
        <input type="hidden" name="_action" value="delete" />
        <input type="hidden" name="id" value={todo.id} />
        <button type="submit">Delete</button>
      </fetcher.Form>
    </li>
  );
}
```

## Error Boundaries

```typescript
import { useRouteError, isRouteErrorResponse } from '@remix-run/react';

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div>
        <h1>{error.status} {error.statusText}</h1>
        <p>{error.data}</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Error</h1>
      <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
    </div>
  );
}
```

## Resource Routes

```typescript
// routes/api/posts.tsx
import { json } from '@remix-run/node';

export async function loader() {
  const posts = await getPosts();
  return json(posts);
}

// No default export = resource route (no UI)
```

## Meta and Links

```typescript
import type { MetaFunction, LinksFunction } from '@remix-run/node';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: data?.post.title ?? 'Blog' },
    { name: 'description', content: data?.post.excerpt },
  ];
};

export const links: LinksFunction = () => {
  return [
    { rel: 'stylesheet', href: styles },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  ];
};
```

## Session Management

```typescript
// utils/session.server.ts
import { createCookieSessionStorage, redirect } from '@remix-run/node';

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET!],
    secure: process.env.NODE_ENV === 'production',
  },
});

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set('userId', userId);

  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionStorage.commitSession(session),
    },
  });
}
```

## Performance

- Prefetch with `<Link prefetch="intent">`
- Use `defer` for streaming data
- Implement stale-while-revalidate with headers
- Code split with dynamic imports
- Cache loader responses appropriately

## Best Practices

- Always validate form data on the server
- Use TypeScript for type safety
- Handle loading and error states
- Implement proper CSRF protection
- Use progressive enhancement
- Test with JavaScript disabled
