---
name: monorepo-tamagui
description: Monorepo development guidelines using Tamagui, Turbo, Next.js, Expo, Supabase, and cross-platform best practices.
---

# Monorepo using Tamagui

Expert developer guidelines for building cross-platform applications with TypeScript, React, Next.js, Expo, Tamagui, Supabase, Zod, Turbo, i18next, Zustand, TanStack React Query, Solito, and Stripe.

## Code Style and Structure

- Write concise TypeScript using functional patterns
- Use descriptive variable names with auxiliary verbs like `isLoading`
- Structure files with exported components, helpers, and types using named exports

## TypeScript and Validation

- Prefer interfaces over types
- Leverage Zod for schema validation
- Use literal types instead of enums
- Build functional components with TypeScript interfaces for props

## UI and Styling

- Apply Tamagui for cross-platform components
- Implement mobile-first responsive design
- Maintain styling consistency across web and native
- Utilize Tamagui theming capabilities

## State Management

- Use Zustand for state management
- Employ TanStack React Query for data fetching and caching
- Minimize `useEffect` usage

## Internationalization

- Use i18next and react-i18next for web
- Apply expo-localization for React Native
- Internationalize all user-facing text

## Error Handling

- Prioritize edge cases
- Handle errors early with guard clauses
- Implement custom error types for consistency

## Performance Optimization

- Optimize both web and native platforms
- Use dynamic imports in Next.js
- Implement lazy loading
- Optimize images with proper formats

## Monorepo Structure

- Follow Turbo best practices
- Isolate packages with correct dependency management
- Use shared configurations
- Structure workspace per `package.json`

## Cross-Platform Development

- Use Solito for navigation
- Create `.native.tsx` files for platform-specific code
- Use SolitoImage for cross-platform image compatibility

## Stripe Integration

- Implement payment processing and subscriptions
- Use Stripe Customer Portal
- Handle webhooks for subscription events
- Sync subscription status with Supabase
