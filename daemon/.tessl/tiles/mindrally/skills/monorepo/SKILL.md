---
name: monorepo
description: Best practices for monorepo development with TypeScript, React, Next.js, Expo, Turbo, and related technologies
---

# Monorepo Development

You are an expert in TypeScript, React and Next.js, Expo (React Native), Tamagui, Supabase, Zod, Turbo (Monorepo Management), i18next, Zustand, TanStack React Query, Solito, and Stripe.

## Code Style and Structure

- Write concise, technical TypeScript code with accurate examples
- Use functional and declarative programming patterns; avoid classes
- Prefer iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`)
- Structure files with exported components, subcomponents, helpers, static content, and types
- Favor named exports for components and functions
- Use lowercase with dashes for directory names (e.g., `components/auth-wizard`)

## TypeScript and Validation

- Use TypeScript for all code; prefer interfaces over types for object shapes
- Utilize Zod for schema validation and type inference
- Avoid enums; use literal types or maps instead
- Implement proper error handling with discriminated unions

## State and Data Management

- Use Zustand for state management
- Use TanStack React Query for data fetching and caching
- Minimize `useEffect` and `setState`; favor derived state
- Implement optimistic updates for better UX

## Monorepo Structure

- Follow best practices using Turbo for monorepo management
- Use separate `apps` and `packages` directories
- Keep shared configurations in the root `configs/` directory
- Use consistent naming conventions for workspaces
- Follow the standard Turborepo workspaces directory structure:
  - `apps/` for application workspaces (Next.js, Expo apps)
  - `packages/` for shared package workspaces (UI, utils, configs)

## Internationalization

- Use i18next for web internationalization
- Use expo-localization for React Native internationalization
- Keep translation files organized by feature or domain

## Error Handling and Validation

- Prioritize error handling and edge cases
- Handle errors and edge cases at the beginning of functions
- Use early returns for error conditions to avoid deeply nested if statements
- Place the happy path last in the function for improved readability
- Avoid unnecessary else statements; use if-return pattern instead
- Use guard clauses to handle preconditions and invalid states early
- Implement proper error logging and user-friendly error messages

## Performance Optimization

- Use dynamic imports for code splitting
- Implement lazy loading for non-critical components
- Optimize images: use WebP format, include size data, implement lazy loading
- Minimize the use of 'use client', 'useEffect', and 'setState'

## Cross-Platform Development

- Use Solito for navigation across web and mobile
- Use `.native.tsx` files for platform-specific code
- Share business logic and UI components through packages

## Backend Integration

- Use Supabase for authentication and database
- Implement Row Level Security (RLS) policies
- Use Zod schemas for API validation
- Handle webhook events properly

## Payments

- Implement Stripe integration with proper webhook handlers
- Handle subscription syncing between Stripe and your database
- Implement proper error handling for payment failures
