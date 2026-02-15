---
name: nextjs-react-redux-typescript-cursor-rules
description: Comprehensive Next.js, React, Redux, and TypeScript development guidelines covering SOLID principles, component architecture, and best practices.
---

# Next.js React Redux TypeScript Cursor Rules

Complete development guidelines for building maintainable, scalable applications with Next.js, React, Redux Toolkit, and TypeScript.

## Development Philosophy

- Produce maintainable, scalable code following SOLID principles
- Favor functional and declarative approaches over imperative styles
- Prioritize type safety and static analysis
- Embrace component-driven architecture

## Code Style Standards

- **Indentation**: Use tabs
- **Strings**: Use single quotes (unless escaping needed)
- **Semicolons**: Omit unless disambiguation required
- **Operators**: Space around infix operators
- **Functions**: Space before declaration parentheses
- **Equality**: Always use `===` over `==`
- **Line length**: Maximum 80 characters
- **Conditionals**: Use braces for multi-line if statements
- **Collections**: Trailing commas in multiline arrays/objects

## Naming Conventions

| Convention | Usage |
|------------|-------|
| PascalCase | Components, type definitions, interfaces |
| kebab-case | Directory and file names (e.g., `user-profile.tsx`) |
| camelCase | Variables, functions, methods, hooks, properties, props |
| UPPERCASE | Environment variables, constants, global configurations |

### Prefixes

- **Event handlers**: `handle` (e.g., `handleClick`)
- **Booleans**: verbs (e.g., `isLoading`, `hasError`, `canSubmit`)
- **Custom hooks**: `use` (e.g., `useAuth`, `useForm`)

## React Best Practices

### Components

- Use functional components with TypeScript interfaces
- Define components using `function` keyword
- Extract reusable logic into custom hooks
- Apply composition patterns properly
- Leverage `React.memo()` strategically
- Implement cleanup in `useEffect` hooks

### Performance

- Use `useCallback` for memoizing functions
- Apply `useMemo` for expensive computations
- Avoid inline function definitions in JSX
- Implement code splitting via dynamic imports
- Use proper `key` props in lists (never use index)

## Next.js Best Practices

### Core

- Use App Router for routing
- Implement metadata management
- Apply proper caching strategies
- Implement error boundaries

### Components

- Use built-in components: `Image`, `Link`, `Script`, `Head`
- Implement loading states
- Use appropriate data fetching methods

### Server Components

- Default to Server Components
- Use URL query parameters for server state
- Apply `use client` only when necessary:
  - Event listeners
  - Browser APIs
  - State management
  - Client libraries

## TypeScript Implementation

- Enable strict mode
- Define clear interfaces for props, state, and Redux structure
- Use type guards for undefined/null safety
- Apply generics for flexibility
- Leverage utility types (`Partial`, `Pick`, `Omit`)
- Prefer `interface` over `type` for objects
- Use mapped types for dynamic type variations

## UI and Styling

### Libraries

- **Shadcn UI**: Consistent, accessible components
- **Radix UI**: Customizable primitives
- **Composition patterns**: Modularity

### Styling

- Tailwind CSS utility-first approach
- Mobile-first responsive design
- Dark mode via CSS variables or Tailwind's dark mode
- Accessible color contrast ratios
- Consistent spacing values
- CSS variables for theme colors

## State Management

### Local State

- `useState` for component-level state
- `useReducer` for complex state
- `useContext` for shared state

### Global State (Redux Toolkit)

- Use `createSlice` for combined state/reducers/actions
- Normalize state structure
- Use selectors for access encapsulation
- Separate concerns by feature (avoid monolithic slices)

## Error Handling and Validation

### Forms

- Zod for schema validation
- React Hook Form integration
- Clear error messaging

### Error Boundaries

- Catch and handle React tree errors gracefully
- Log errors to external services (e.g., Sentry)
- Display user-friendly fallback UIs

## Testing

### Unit Testing

- Jest and React Testing Library
- Arrange-Act-Assert pattern
- Mock external dependencies and API calls

### Integration Testing

- Focus on user workflows
- Proper test environment setup/teardown
- Selective snapshot testing
- Use testing utilities (`screen` in RTL)

## Accessibility (a11y)

- Semantic HTML
- Accurate ARIA attributes
- Full keyboard navigation
- Proper focus management
- Accessible color contrast
- Logical heading hierarchy
- Accessible interactive elements
- Clear error feedback

## Security

- Input sanitization to prevent XSS
- DOMPurify for HTML sanitization
- Proper authentication methods

## Internationalization (i18n)

- next-i18next for translations
- Locale detection
- Number and date formatting
- RTL support
- Currency formatting

## Documentation

- JSDoc for all public functions, classes, methods, interfaces
- Complete sentences with proper punctuation
- Clear, concise descriptions
- Proper markdown, code blocks, links, headings, lists
- Examples when appropriate
