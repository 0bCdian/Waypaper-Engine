---
name: turbopack-bundler
description: Best practices and guidelines for Turbopack, the Rust-powered incremental bundler for Next.js and modern web development
---

# Turbopack Bundler

You are an expert in Turbopack, the incremental bundler optimized for JavaScript and TypeScript, written in Rust and built into Next.js. Follow these guidelines when working with Turbopack.

## Core Principles

- Turbopack is designed for incremental computation and caching
- Function-level caching through the Turbo engine
- Native Rust performance for fast builds
- Built-in support for TypeScript and JSX
- Optimized for Next.js integration
- Abstracts away webpack configurations

## Project Structure

```
project/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/       # Shared components
│   └── lib/              # Utility functions
├── public/               # Static assets
├── next.config.js        # Next.js configuration
├── tsconfig.json         # TypeScript config
└── package.json
```

## Enabling Turbopack

### Development Mode

```bash
# Next.js 13.4+
next dev --turbo

# Or in package.json
{
  "scripts": {
    "dev": "next dev --turbo"
  }
}
```

### Next.js Configuration

```javascript
// next.config.js
module.exports = {
  experimental: {
    turbo: {
      // Turbopack-specific configuration
    }
  }
};
```

## Configuration Options

### Custom Loaders

```javascript
// next.config.js
module.exports = {
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js'
      },
      '*.mdx': {
        loaders: ['@mdx-js/loader']
      }
    }
  }
};
```

### Resolve Aliases

```javascript
// next.config.js
module.exports = {
  turbopack: {
    resolveAlias: {
      '@components': './src/components',
      '@lib': './src/lib',
      '@styles': './src/styles'
    }
  }
};
```

### Resolve Extensions

```javascript
// next.config.js
module.exports = {
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json']
  }
};
```

## Built-in Support

Turbopack has built-in support for:

- **TypeScript**: No configuration needed
- **JSX/TSX**: Automatic transformation
- **CSS**: Native CSS support
- **CSS Modules**: `.module.css` files
- **PostCSS**: Automatic processing
- **Static Assets**: Images, fonts, etc.

No loaders needed for:
- `css-loader`
- `postcss-loader`
- `babel-loader` (for `@babel/preset-env`)

## TypeScript Configuration

### Recommended tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Path Aliases

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@lib/*": ["src/lib/*"],
      "@styles/*": ["src/styles/*"]
    }
  }
}
```

## Code Organization

### Atomic Design Pattern

```
src/
├── components/
│   ├── atoms/          # Basic building blocks
│   │   ├── Button/
│   │   └── Input/
│   ├── molecules/      # Combinations of atoms
│   │   ├── SearchBar/
│   │   └── NavItem/
│   ├── organisms/      # Complex components
│   │   ├── Header/
│   │   └── Footer/
│   └── templates/      # Page layouts
│       └── MainLayout/
├── app/
│   └── page.tsx
└── lib/
    └── utils.ts
```

### Component Structure

```
Button/
├── Button.tsx
├── Button.module.css
├── Button.test.tsx
└── index.ts
```

## Code Splitting

### Dynamic Imports

```typescript
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false // Disable server-side rendering if needed
});
```

### Route-Based Splitting

Next.js automatically code-splits by route in the `app/` directory.

### Manual Splitting

```typescript
// Split large components
const ChartComponent = dynamic(() => import('./ChartComponent'));
const EditorComponent = dynamic(() => import('./EditorComponent'));
```

## Caching Strategy

### Turbo Engine Caching

- Function-level caching for incremental builds
- Only recomputes what changed
- Persistent cache across builds

### Optimizing for Cache

```typescript
// Keep modules focused and small
// Changes to one module don't invalidate others

// Good: Separate concerns
export function formatDate(date: Date) { /* ... */ }
export function formatCurrency(amount: number) { /* ... */ }

// Avoid: Large utility files that change frequently
```

## Performance Best Practices

### Module Organization

- Keep modules small and focused
- Minimize cross-module dependencies
- Use barrel exports sparingly

### Import Optimization

```typescript
// Prefer specific imports
import { Button } from '@/components/Button';

// Avoid importing entire libraries
// Bad: import _ from 'lodash';
// Good: import debounce from 'lodash/debounce';
```

### Static Analysis

```typescript
// Use const assertions for better tree-shaking
const ROUTES = {
  home: '/',
  about: '/about',
  contact: '/contact'
} as const;
```

## CSS Handling

### CSS Modules

```typescript
import styles from './Component.module.css';

function Component() {
  return <div className={styles.container}>Content</div>;
}
```

### Global CSS

```typescript
// app/layout.tsx
import './globals.css';
```

### Tailwind CSS

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}'
  ]
};
```

## Environment Variables

### Next.js Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.example.com
DATABASE_URL=postgresql://...
```

```typescript
// Client-side (must have NEXT_PUBLIC_ prefix)
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// Server-side only
const dbUrl = process.env.DATABASE_URL;
```

## Testing

### Test Organization

```
src/
├── components/
│   └── Button/
│       ├── Button.tsx
│       └── Button.test.tsx    # Co-located test
└── __tests__/                 # Integration tests
    └── pages/
        └── home.test.tsx
```

### Testing Best Practices

- Write unit tests for utility functions
- Use React Testing Library for components
- End-to-end tests with Cypress or Playwright
- Keep tests close to the code they test

## Common Pitfalls

### Configuration Issues

```json
// Ensure correct tsconfig.json paths
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]  // Must match actual structure
    }
  }
}
```

### Caching Problems

```bash
# Clear Turbopack cache if issues arise
rm -rf .next
```

### Compatibility

- Check dependency compatibility with Turbopack
- Some webpack plugins may not work directly
- Use Next.js configuration instead of webpack config

## Migration from Webpack

### What Changes

- No direct webpack.config.js
- Use next.config.js for customization
- Some loaders need Turbopack equivalents

### What Stays the Same

- Import syntax
- Dynamic imports
- CSS Modules
- TypeScript support

## Best Practices Summary

### Do

- Use Next.js configurations for customization
- Leverage built-in TypeScript and JSX support
- Organize code for incremental computation
- Use dynamic imports for code splitting
- Keep modules focused and small

### Avoid

- Direct webpack configurations
- Large barrel files that change frequently
- Fighting against Next.js conventions
- Ignoring TypeScript path configuration

## Debugging

### Verbose Logging

```bash
NEXT_DEBUG_TURBOPACK=1 next dev --turbo
```

### Build Analysis

```bash
# Check build output
ANALYZE=true next build
```

### Common Issues

1. **Slow initial build**: Normal, subsequent builds are fast
2. **Module not found**: Check path aliases in tsconfig.json
3. **CSS not loading**: Ensure proper import syntax
4. **Type errors**: Run `tsc --noEmit` separately
