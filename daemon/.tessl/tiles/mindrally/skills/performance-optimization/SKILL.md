---
name: performance-optimization
description: Performance optimization guidelines for web development including server-side rendering, CSS best practices, and JavaScript optimization
---

# Performance Optimization

Apply these performance optimization principles when developing web applications, themes, and frontend interfaces.

## Core Performance Principles

- Prioritize server-side rendering as a first principle, as opposed to client-side JavaScript
- Minimize client-side JavaScript to reduce bundle size and improve Time to Interactive
- Optimize for Core Web Vitals: LCP, FID, and CLS
- Measure performance continuously and establish baselines
- Consider performance impact of every architectural decision

## Server-Side Rendering

- Render content server-side whenever possible
- Use streaming rendering for faster Time to First Byte
- Implement proper caching strategies for rendered content
- Avoid blocking resources that delay rendering
- Pre-render static content where applicable

## CSS Best Practices

### Selector Efficiency
- Avoid ID selectors for styling; use classes instead
- Maintain specificity at 0 1 0 where possible
- Avoid deep nesting of selectors (max 3 levels)
- Use BEM or similar naming conventions for clarity
- Prefer class selectors over element selectors

### CSS Organization
- Use CSS variables for colors, spacing, and repeated values
- Group related styles logically
- Remove unused CSS to reduce payload
- Consider critical CSS inlining for above-the-fold content
- Use CSS containment for complex layouts

### Layout Performance
- Avoid layout thrashing (forced synchronous layouts)
- Use transform and opacity for animations (GPU accelerated)
- Minimize paint and composite operations
- Use will-change sparingly and intentionally
- Prefer flexbox and grid over floats and positioning

## JavaScript Optimization

### Code Organization
- Use the module pattern for code organization
- Prefix private methods with appropriate indicators
- Prefer const over let; avoid var
- Avoid external dependencies when native APIs suffice
- Split code into logical, loadable chunks

### Loading Strategies
- Defer non-critical JavaScript
- Use async loading for independent scripts
- Implement code splitting for large applications
- Lazy load components and routes
- Preload critical resources

### Runtime Performance
- Debounce and throttle event handlers appropriately
- Use requestAnimationFrame for visual updates
- Avoid long-running synchronous operations
- Implement efficient DOM manipulation patterns
- Use Web Workers for CPU-intensive tasks

## Asset Optimization

### Images
- Use modern formats (WebP, AVIF) with fallbacks
- Implement responsive images with srcset
- Lazy load below-the-fold images
- Optimize and compress all images
- Use appropriate image dimensions

### Fonts
- Subset fonts to include only needed characters
- Use font-display: swap for better perceived performance
- Preload critical fonts
- Limit the number of font variations
- Consider system fonts for non-branded text

## Caching Strategies

- Implement appropriate cache headers for static assets
- Use versioned filenames for cache busting
- Configure CDN caching effectively
- Implement service workers for offline support
- Cache API responses where appropriate

## Architecture Patterns

### Theme and Component Architecture
- Organize code into logical sections and blocks
- Use proper folder structure for maintainability
- Implement clear separation of concerns
- Create reusable, composable components
- Document component APIs and usage

### Configuration and Settings
- Organize settings logically with clear groupings
- Use clear, descriptive naming conventions
- Implement conditional logic to reduce complexity
- Provide sensible defaults
- Validate configuration at build time

## Internationalization Performance

- Ensure all text is translatable
- Load translations efficiently (split by locale)
- Use proper locale detection
- Cache translated content appropriately
- Consider right-to-left (RTL) layout implications

## Measurement and Monitoring

- Use Real User Monitoring (RUM) for production insights
- Set up synthetic monitoring for baseline tracking
- Monitor Core Web Vitals continuously
- Track performance budgets in CI/CD
- Analyze and act on performance regressions

## Database Performance

- Optimize queries and use proper indexing
- Implement connection pooling
- Use caching for frequently accessed data
- Paginate large result sets
- Monitor slow queries and optimize regularly
