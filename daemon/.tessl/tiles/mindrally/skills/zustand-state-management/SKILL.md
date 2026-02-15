---
name: zustand-state-management
description: Best practices for Zustand state management in React and Next.js applications with TypeScript.
---

# Zustand State Management

You are an expert in Zustand state management for React and Next.js applications.

## Core Principles

- Use Zustand for lightweight, flexible state management
- Minimize `useEffect` and `setState`; prioritize derived state and memoization
- Implement functional, declarative patterns avoiding classes
- Use descriptive variable names with auxiliary verbs like `isLoading`, `hasError`

## Store Design

### Basic Store Structure
```typescript
import { create } from 'zustand'

interface BearState {
  bears: number
  isLoading: boolean
  hasError: boolean
  increase: () => void
  reset: () => void
}

const useBearStore = create<BearState>((set) => ({
  bears: 0,
  isLoading: false,
  hasError: false,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
  reset: () => set({ bears: 0 }),
}))
```

### Best Practices
- Keep stores focused and modular
- Use selectors to prevent unnecessary re-renders
- Implement middleware for persistence, logging, or devtools
- Separate actions from state when stores grow complex

## Integration with React

- Use shallow equality for selecting multiple values
- Combine with TanStack React Query for server state
- Implement proper TypeScript interfaces for type safety
- Use zustand/middleware for persistence and devtools

## Performance Optimization

- Select only the state you need in components
- Use shallow comparison for object selections
- Avoid selecting the entire store
- Memoize computed values when necessary

## Middleware Usage

### Persistence
```typescript
import { persist } from 'zustand/middleware'

const useStore = create(
  persist(
    (set) => ({
      // state and actions
    }),
    { name: 'store-key' }
  )
)
```

### DevTools
```typescript
import { devtools } from 'zustand/middleware'

const useStore = create(
  devtools((set) => ({
    // state and actions
  }))
)
```

## Error Handling

- Handle errors at function start using early returns and guard clauses
- Implement error states within stores
- Use try-catch in async actions
- Provide meaningful error messages

## Testing

- Test stores independently of components
- Mock Zustand stores in component tests
- Verify state transitions and actions
- Test middleware behavior separately
