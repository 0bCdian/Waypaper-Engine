---
name: sveltekit
description: Expert guidance for SvelteKit development with TypeScript, Tailwind CSS, SSR/SSG, and performance optimization best practices
---

# SvelteKit Development

You are an expert in SvelteKit, TypeScript, Tailwind CSS, and modern web application development.

## Key Principles

- Write concise, technical SvelteKit code with accurate TypeScript examples
- Use functional and declarative programming patterns; avoid classes
- Prefer iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (isLoading, hasError)
- Structure files: component logic, markup, styles, helpers, types

## Project Structure

```
src/
├── lib/
│   ├── components/     # Reusable Svelte components
│   ├── server/         # Server-only utilities
│   ├── stores/         # Svelte stores
│   └── utils/          # Shared utilities
├── routes/
│   ├── +layout.svelte  # Root layout
│   ├── +page.svelte    # Home page
│   └── api/            # API routes
├── app.html            # HTML template
└── app.css             # Global styles
```

## Component Development

### Script Setup with TypeScript
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  let count = 0;
  $: doubled = count * 2;

  function increment() {
    count += 1;
  }
</script>
```

### Props and Events
```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title: string;
  export let disabled = false;

  const dispatch = createEventDispatcher<{
    submit: { value: string };
  }>();

  function handleSubmit() {
    dispatch('submit', { value: title });
  }
</script>
```

## Routing

### File-Based Routes
```
routes/
├── +page.svelte          # /
├── about/+page.svelte    # /about
├── blog/
│   ├── +page.svelte      # /blog
│   └── [slug]/
│       └── +page.svelte  # /blog/:slug
```

### Dynamic Routes
```svelte
<!-- routes/blog/[slug]/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;
</script>

<h1>{data.post.title}</h1>
```

### Load Functions
```typescript
// +page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
  const response = await fetch(`/api/posts/${params.slug}`);
  const post = await response.json();

  return { post };
};
```

## SSR and SSG

### Server-Side Rendering
```typescript
// +page.server.ts
export const ssr = true;
export const csr = true;

export const load: PageServerLoad = async ({ locals }) => {
  return {
    user: locals.user
  };
};
```

### Static Generation
```typescript
// +page.ts
export const prerender = true;

export async function load() {
  return {
    // Static data
  };
}
```

### Prerendering Dynamic Routes
```typescript
// +page.server.ts
export const prerender = true;

export async function entries() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}
```

## Form Actions

```typescript
// +page.server.ts
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email');

    // Validate and process
    if (!email) {
      return { success: false, error: 'Email required' };
    }

    return { success: true };
  }
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';

  export let form: ActionData;
</script>

<form method="POST" use:enhance>
  <input name="email" type="email" />
  <button type="submit">Subscribe</button>
  {#if form?.error}
    <p class="error">{form.error}</p>
  {/if}
</form>
```

## State Management

### Svelte Stores
```typescript
// lib/stores/counter.ts
import { writable, derived } from 'svelte/store';

export const count = writable(0);
export const doubled = derived(count, ($count) => $count * 2);

export function increment() {
  count.update((n) => n + 1);
}
```

### Page Store
```svelte
<script lang="ts">
  import { page } from '$app/stores';

  $: currentPath = $page.url.pathname;
  $: params = $page.params;
</script>
```

## API Routes

```typescript
// routes/api/posts/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const limit = url.searchParams.get('limit') ?? '10';
  const posts = await getPosts(Number(limit));

  return json(posts);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const post = await createPost(body);

  return json(post, { status: 201 });
};
```

## Styling with Tailwind

```svelte
<div class="flex flex-col gap-4 p-6">
  <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
    {title}
  </h1>
  <p class="text-gray-600 dark:text-gray-300">
    {description}
  </p>
</div>

<style>
  /* Scoped styles when needed */
  :global(.prose) {
    @apply max-w-none;
  }
</style>
```

## Error Handling

```svelte
<!-- +error.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
</script>

<h1>{$page.status}</h1>
<p>{$page.error?.message}</p>
```

```typescript
// +page.server.ts
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
  const post = await getPost(params.slug);

  if (!post) {
    throw error(404, 'Post not found');
  }

  return { post };
};
```

## Performance Optimization

- Use `{#key}` blocks for component recreation
- Implement lazy loading with dynamic imports
- Use `$effect.pre` for DOM measurements
- Optimize images with `@sveltejs/enhanced-img`
- Prefetch links with `data-sveltekit-preload-data`

## Testing

```typescript
// Component testing with Vitest
import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import Button from './Button.svelte';

test('renders button with text', () => {
  render(Button, { props: { label: 'Click me' } });
  expect(screen.getByRole('button')).toHaveTextContent('Click me');
});
```

## Accessibility

- Use semantic HTML elements
- Add ARIA labels where needed
- Ensure keyboard navigation
- Test with screen readers
- Maintain focus management
