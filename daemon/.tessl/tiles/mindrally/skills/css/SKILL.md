---
name: css
description: Best practices for CSS development including modern layout techniques, naming conventions, theming, and maintainable stylesheet architecture
---

# CSS Development Guidelines

## Core Principles

- Write semantic HTML to improve accessibility and SEO
- Use CSS for styling, avoiding inline styles
- Ensure responsive design using media queries and flexible layouts
- Prioritize external stylesheets over inline or embedded styles

## Layout Techniques

### Flexbox
- Use Flexbox for one-dimensional layouts (rows or columns)
- Leverage `justify-content` and `align-items` for alignment
- Use `flex-wrap` for responsive wrapping behavior
- Prefer `gap` property over margins for consistent spacing

### Grid
- Use CSS Grid for two-dimensional layouts
- Define grid templates with `grid-template-columns` and `grid-template-rows`
- Use `grid-area` for named template areas
- Leverage `auto-fit` and `auto-fill` for responsive grids

## Units and Typography

- Use `rem` units for typography to respect user preferences
- Use `em` units for component-relative sizing
- Avoid `px` for font sizes; reserve for borders and fixed elements
- Implement fluid typography with `clamp()` when appropriate
- Use viewport units (`vw`, `vh`) thoughtfully for full-screen layouts

## CSS Variables (Custom Properties)

- Define design tokens as CSS variables on `:root`
- Use variables for colors, spacing, typography, and shadows
- Implement theming by overriding variables in different contexts
- Name variables semantically (e.g., `--color-primary`, `--spacing-md`)

## Naming Conventions

### BEM Methodology
- Block: Standalone component (e.g., `.card`)
- Element: Part of a block (e.g., `.card__title`)
- Modifier: Variation of block or element (e.g., `.card--featured`)

### Best Practices
- Use lowercase with hyphens for class names
- Avoid IDs for styling; reserve for JavaScript hooks
- Keep specificity low by using single class selectors
- Scope styles to components to prevent conflicts

## Specificity Management

- Maintain specificity at 0-1-0 (single class) when possible
- Avoid `!important` declarations
- Use cascading intentionally, not accidentally
- Consider CSS Layers (`@layer`) for specificity control

## Responsive Design

- Implement mobile-first media queries
- Use relative units for flexible layouts
- Test across multiple viewport sizes
- Consider container queries for component-level responsiveness

## Performance

- Minimize selector complexity
- Avoid deeply nested selectors
- Use efficient selectors (class over element)
- Leverage CSS containment for isolated components
- Consider critical CSS for above-the-fold content

## Modern CSS Features

- Use `aspect-ratio` for maintaining proportions
- Leverage `gap` in Flexbox and Grid
- Use logical properties (`margin-inline`, `padding-block`)
- Implement smooth transitions with `transition` property
- Use `@supports` for feature detection

## Organization

- Structure stylesheets logically (base, layout, components, utilities)
- Keep files modular and focused
- Document complex styles with comments
- Use a consistent property order within declarations

## Browser Compatibility

- Use vendor prefixes when necessary (consider Autoprefixer)
- Test across target browsers
- Provide fallbacks for newer features
- Use progressive enhancement approach

## Accessibility

- Ensure sufficient color contrast (WCAG AA minimum)
- Provide visible focus styles for keyboard navigation
- Avoid hiding content in ways that affect screen readers
- Use `prefers-reduced-motion` media query for animations
