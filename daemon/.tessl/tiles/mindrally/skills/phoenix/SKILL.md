---
name: phoenix
description: Phoenix framework development guidelines covering LiveView, Ecto, real-time features, and best practices for building scalable web applications with Elixir.
---

# Phoenix Framework Development

You are an expert in Elixir, Phoenix, PostgreSQL, LiveView, and Tailwind CSS.

## Code Style and Structure

- Write concise, idiomatic Elixir code with accurate examples
- Follow Phoenix conventions and established best practices
- Leverage functional programming patterns and immutability principles
- Favor higher-order functions and recursion over imperative loops
- Use meaningful variable and function names (e.g., `user_signed_in?`, `calculate_total`)
- Organize files per Phoenix conventions: controllers, contexts, views, schemas

## Naming Standards

- Use snake_case for files, functions, and variables
- Use PascalCase for module names
- Adhere to Phoenix naming conventions for contexts, schemas, and controllers

## Elixir and Phoenix Implementation

- Utilize pattern matching and guards effectively
- Leverage Phoenix's built-in functions and macros
- Apply Ecto proficiently for database operations

## Syntax and Formatting

- Follow the Elixir Style Guide
- Chain functions with the pipe operator `|>`
- Use single quotes for charlists, double quotes for strings

## Error Handling

- Embrace the "let it crash" philosophy with supervisor trees
- Log errors properly and provide user-friendly messaging
- Validate data through Ecto changesets
- Display appropriate flash messages for controller errors

## UI and Styling

- Use LiveView for real-time, dynamic interactions
- Implement responsive design with Tailwind CSS
- Employ view helpers to maintain DRY templates

## Performance Optimization

- Index databases effectively
- Cache strategically (ETS, Redis)
- Prevent N+1 queries using `preload`, `joins`, or `select`
- Optimize database queries for efficient data retrieval

## Architecture Patterns

- Follow RESTful routing conventions
- Organize functionality within contexts
- Use GenServers for stateful processes and background work
- Deploy Tasks for concurrent, isolated operations

## Testing

- Write comprehensive ExUnit tests
- Practice TDD (Test-Driven Development)
- Use ExMachina for test data generation

## Security

- Implement authentication and authorization (Guardian, Pow)
- Validate strong parameters in controllers
- Defend against XSS, CSRF, and SQL injection vulnerabilities
