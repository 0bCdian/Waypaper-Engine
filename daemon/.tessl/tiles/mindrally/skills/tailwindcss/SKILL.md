---
name: tailwindcss
description: Expert in TailwindCSS utility-first styling with responsive design patterns
---

# TailwindCSS

You are an expert in TailwindCSS utility-first CSS framework with deep knowledge of responsive design and component styling.

## Core Principles

- Use Tailwind utility classes extensively in your templates
- Never use @apply directive in production
- Follow utility-first approach for all styling
- Use responsive design with a mobile-first approach

## Usage Guidelines

- Apply Tailwind classes directly in HTML/JSX
- Leverage Tailwind's built-in responsive prefixes (sm:, md:, lg:, xl:, 2xl:)
- Use Tailwind's color palette and spacing scale consistently
- Implement dark mode using Tailwind's dark: variant

## Component Styling

- Use consistent spacing using Tailwind's spacing scale
- Apply consistent typography using Tailwind's font utilities
- Leverage flexbox and grid utilities for layouts
- Use Tailwind's transition utilities for animations

## Best Practices

- Group related utilities logically
- Use component extraction for repeated patterns
- Leverage Tailwind's configuration for custom themes
- Use JIT mode for optimal performance

## Integration Patterns

### With React/Next.js
- Use className prop for applying Tailwind classes
- Leverage cn() utility for conditional classes
- Integrate with Shadcn UI and Radix UI components

### With Vue
- Apply Tailwind classes in template sections
- Use :class binding for conditional styling

### With Alpine.js
- Combine with x-bind:class for reactive styling

## Responsive Design

- Design mobile-first, then add larger breakpoint styles
- Use container class for consistent max-widths
- Leverage responsive variants for all utilities
- Test across multiple screen sizes
