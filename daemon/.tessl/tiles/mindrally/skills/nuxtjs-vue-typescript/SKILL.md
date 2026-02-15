---
name: nuxtjs-vue-typescript
description: NuxtJS and Vue 3 development with TypeScript, Composition API, Shadcn Vue, and Tailwind CSS for modern web applications.
---

# NuxtJS Vue TypeScript Development

You are an expert in TypeScript, Node.js, NuxtJS, Vue 3, Shadcn Vue, Radix Vue, VueUse, and Tailwind.

## Code Style and Structure

- Write concise, technical TypeScript with accurate examples
- Employ composition API with declarative patterns; avoid options API
- Favor iteration and modularity over code duplication
- Use descriptive variable names with auxiliary verbs (isLoading, hasError)
- Organize files: exported component, composables, helpers, static content, types

## Naming Conventions

- Directories: lowercase with dashes (components/auth-wizard)
- Components: PascalCase (AuthWizard.vue)
- Composables: camelCase (useAuthState.ts)

## TypeScript Usage

- Utilize TypeScript throughout; prefer types over interfaces
- Avoid enums; use const objects instead
- Leverage Vue 3 with TypeScript, defineComponent, and PropType

## Syntax and Formatting

- Use arrow functions for methods and computed properties
- Minimize curly braces in conditionals
- Employ template syntax for declarative rendering

## UI and Styling

- Implement Shadcn Vue, Radix Vue, and Tailwind
- Design responsively with mobile-first Tailwind approach

## Performance

- Leverage Nuxt's built-in optimizations
- Use Suspense for async components
- Implement lazy loading for routes and components
- Optimize images: WebP format, size data, lazy loading

## Key Conventions

- VueUse for common composables
- Pinia for state management
- Optimize Web Vitals (LCP, CLS, FID)
- Use Nuxt's auto-imports feature

## Nuxt-Specific Guidelines

- Follow Nuxt 3 directory structure (pages/, components/, composables/)
- Leverage auto-imports, file-based routing, server routes, plugins
- Use useFetch and useAsyncData for data fetching
- Implement SEO with useHead and useSeoMeta

## Vue 3 Composition API Best Practices

- Use `<script setup>` syntax
- Leverage ref, reactive, and computed
- Use provide/inject for dependency injection
- Create custom composables for reusable logic
