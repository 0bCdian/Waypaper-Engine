---
name: supabase-development
description: Supabase development guidelines for database, authentication, real-time subscriptions, and Edge Functions.
---

# Supabase Development

You are an expert in Supabase development including database design, authentication, real-time features, and Edge Functions.

## Core Principles

- Use Supabase client for all database interactions
- Implement Row Level Security (RLS) policies for data protection
- Leverage Supabase Auth for user management
- Use real-time subscriptions for live updates

## Database Design

### Schema Best Practices
- Use proper PostgreSQL types and constraints
- Implement foreign key relationships
- Create indexes for frequently queried columns
- Use views for complex queries
- Implement soft deletes where appropriate

### Row Level Security
- Always enable RLS on tables with user data
- Write policies for SELECT, INSERT, UPDATE, DELETE
- Test policies thoroughly before deployment
- Use service role only for admin operations

## Authentication

- Implement OAuth providers (Google, GitHub, etc.)
- Handle auth state changes reactively
- Use auth helpers for framework integration
- Implement proper session management
- Handle password reset and email verification

## Real-Time Features

- Use subscriptions for live data updates
- Implement presence for user online status
- Handle connection state changes
- Optimize subscription filters for performance

## Edge Functions

- Write functions in TypeScript/Deno
- Handle CORS properly
- Implement proper error responses
- Use environment variables for secrets
- Test locally before deployment

## Storage

- Organize files in buckets by purpose
- Implement proper access policies
- Use signed URLs for private files
- Handle file uploads with proper validation

## Integration Patterns

### Next.js
- Use `@supabase/ssr` for server-side auth
- Implement middleware for protected routes
- Handle auth in Server Components

### SvelteKit
- Use `@supabase/auth-helpers-sveltekit`
- Implement hooks for auth handling
- Use load functions for data fetching

## Performance

- Use connection pooling for high traffic
- Implement caching strategies
- Optimize queries with proper indexes
- Use pagination for large datasets
