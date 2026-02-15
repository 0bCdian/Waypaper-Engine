---
name: nodejs-development
description: Node.js development guidelines covering Payload CMS, Vue.js with TypeScript, and general TypeScript best practices
---

# Node.js Development Guidelines

You are an expert in Node.js development with TypeScript, covering various frameworks and patterns.

## Payload CMS with Next.js

### Project Setup
```
project/
├── src/
│   ├── app/              # Next.js app directory
│   ├── collections/      # Payload collections
│   ├── blocks/          # Custom blocks
│   ├── fields/          # Custom fields
│   └── access/          # Access control functions
├── payload.config.ts    # Payload configuration
└── next.config.js       # Next.js configuration
```

### Collection Definition
```typescript
import { CollectionConfig } from 'payload/types';

const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
    },
    {
      name: 'publishedDate',
      type: 'date',
    },
  ],
};

export default Posts;
```

### API Routes
```typescript
// app/api/posts/route.ts
import { getPayloadClient } from '@/lib/payload';

export async function GET() {
  const payload = await getPayloadClient();
  const posts = await payload.find({
    collection: 'posts',
    limit: 10,
  });
  return Response.json(posts);
}
```

## Vue.js with TypeScript

### Component Structure
```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface User {
  id: number;
  name: string;
  email: string;
}

const props = defineProps<{
  userId: number;
}>();

const emit = defineEmits<{
  (e: 'update', user: User): void;
}>();

const user = ref<User | null>(null);
const isLoading = ref(false);

const displayName = computed(() => user.value?.name ?? 'Unknown');

async function fetchUser() {
  isLoading.value = true;
  try {
    const response = await fetch(`/api/users/${props.userId}`);
    user.value = await response.json();
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchUser);
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="user">
    <h2>{{ displayName }}</h2>
    <p>{{ user.email }}</p>
  </div>
</template>
```

### Composables
```typescript
// composables/useApi.ts
import { ref } from 'vue';

export function useApi<T>(url: string) {
  const data = ref<T | null>(null);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  async function execute() {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Request failed');
      data.value = await response.json();
    } catch (e) {
      error.value = e as Error;
    } finally {
      isLoading.value = false;
    }
  }

  return { data, error, isLoading, execute };
}
```

### Pinia Store
```typescript
// stores/user.ts
import { defineStore } from 'pinia';

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    user: null,
    isAuthenticated: false,
  }),

  getters: {
    displayName: (state) => state.user?.name ?? 'Guest',
  },

  actions: {
    async login(credentials: LoginCredentials) {
      const user = await authService.login(credentials);
      this.user = user;
      this.isAuthenticated = true;
    },

    logout() {
      this.user = null;
      this.isAuthenticated = false;
    },
  },
});
```

## TypeScript with Zod

### Schema Definition
```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['user', 'admin']),
  createdAt: z.date(),
});

type User = z.infer<typeof UserSchema>;

const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true });
type CreateUserInput = z.infer<typeof CreateUserSchema>;
```

### Validation
```typescript
function createUser(input: unknown): User {
  const validatedInput = CreateUserSchema.parse(input);
  // Input is now typed as CreateUserInput
  return {
    ...validatedInput,
    id: generateId(),
    createdAt: new Date(),
  };
}

// Safe parsing (doesn't throw)
function validateUser(input: unknown) {
  const result = UserSchema.safeParse(input);
  if (!result.success) {
    console.error(result.error.issues);
    return null;
  }
  return result.data;
}
```

### API Validation Middleware
```typescript
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

function validate<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ errors: result.error.issues });
    }
    req.body = result.data;
    next();
  };
}

// Usage
app.post('/users', validate(CreateUserSchema), createUserHandler);
```

## General Best Practices

### Error Handling
- Use custom error classes
- Implement global error handlers
- Log errors with context
- Return appropriate status codes

### Async Patterns
- Use async/await consistently
- Handle promise rejections
- Implement proper timeouts
- Use Promise.all for parallel operations

### Testing
- Write unit tests for utilities
- Integration tests for APIs
- Use test fixtures
- Mock external dependencies
