---
name: responsive-design
description: Comprehensive guidelines for responsive web design including mobile-first approach, flexible layouts, media queries, and cross-device optimization
---

# Responsive Design Guidelines

## Core Principles

- Write semantic HTML to improve accessibility and SEO
- Use CSS for styling, avoiding inline styles
- Ensure responsive design using media queries and flexible layouts
- Prioritize accessibility by using ARIA roles and attributes
- Design mobile-first, then enhance for larger screens

## Mobile-First Approach

### Strategy
- Start with styles for the smallest viewport
- Add complexity through progressive enhancement
- Base styles work without media queries
- Media queries add features for larger screens

### Benefits
- Forces prioritization of essential content
- Improves performance on mobile devices
- Ensures core functionality works everywhere
- Reduces CSS complexity and specificity issues

```css
/* Base styles for mobile */
.container {
  padding: 1rem;
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

## Flexible Layouts

### Flexbox
- Use for one-dimensional layouts (row or column)
- Leverage `flex-wrap` for responsive wrapping
- Use `gap` for consistent spacing
- Combine with media queries for layout changes

### CSS Grid
- Use for two-dimensional layouts
- Leverage `auto-fit` and `auto-fill` for responsive grids
- Use `minmax()` for flexible track sizing
- Combine `fr` units with fixed minimums

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}
```

### Container Queries
- Style components based on container size, not viewport
- Use for truly reusable components
- Define containers with `container-type`

## Responsive Typography

### Fluid Typography
- Use `clamp()` for responsive font sizes
- Set minimum, preferred, and maximum values
- Avoid text that's too small on mobile or too large on desktop

```css
h1 {
  font-size: clamp(1.5rem, 4vw + 1rem, 3rem);
}
```

### Units
- Use `rem` for scalable typography
- Base `rem` on user's browser settings
- Use `em` for component-relative sizing
- Avoid fixed `px` values for font sizes

## Responsive Images

### Srcset and Sizes
- Use `srcset` for multiple image resolutions
- Use `sizes` to indicate display size at breakpoints
- Let browser choose optimal image

```html
<img
  src="image-800.jpg"
  srcset="image-400.jpg 400w, image-800.jpg 800w, image-1200.jpg 1200w"
  sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 800px"
  alt="Description"
>
```

### Picture Element
- Use for art direction (different crops at different sizes)
- Provide fallback with `<img>` element
- Use media attributes for breakpoint-specific sources

### Performance
- Include `width` and `height` attributes to prevent layout shift
- Use `loading="lazy"` for below-fold images
- Consider `aspect-ratio` CSS property

## Media Queries

### Common Breakpoints
```css
/* Small phones */
@media (min-width: 320px) { }

/* Large phones */
@media (min-width: 480px) { }

/* Tablets */
@media (min-width: 768px) { }

/* Laptops/Desktops */
@media (min-width: 1024px) { }

/* Large screens */
@media (min-width: 1280px) { }

/* Extra large screens */
@media (min-width: 1536px) { }
```

### Feature Queries
- Use `@supports` for feature detection
- Provide fallbacks for unsupported features
- Test for specific CSS properties

### Preference Queries
- `prefers-color-scheme` for dark/light mode
- `prefers-reduced-motion` for animation preferences
- `prefers-contrast` for contrast preferences

## Touch Targets

### Sizing
- Minimum 44x44 pixels for touch targets
- Provide adequate spacing between targets
- Consider thumb reach zones on mobile

### Interaction
- Don't rely solely on hover states
- Provide touch alternatives for hover interactions
- Use `@media (hover: hover)` for hover-capable devices

## Viewport Configuration

### Meta Tag
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

### Best Practices
- Always include viewport meta tag
- Don't disable user scaling (avoid `user-scalable=no`)
- Test with pinch-to-zoom enabled
- Ensure content is usable at 200% zoom

## Testing

### Tools
- Browser DevTools device emulation
- Real device testing when possible
- Lighthouse for performance audits
- W3C validators for code quality

### Checklist
- Test at multiple viewport sizes
- Test landscape and portrait orientations
- Test with touch and mouse input
- Test with keyboard navigation
- Verify images load appropriate sizes
- Check typography readability
- Verify touch targets are adequate
- Test with browser zoom

## Performance Considerations

### Critical CSS
- Inline critical above-fold CSS
- Defer non-critical stylesheets
- Minimize render-blocking resources

### Asset Optimization
- Compress images appropriately
- Use modern formats (WebP, AVIF)
- Lazy load below-fold content
- Consider responsive loading strategies
