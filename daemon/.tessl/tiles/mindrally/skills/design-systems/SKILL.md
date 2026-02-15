---
name: design-systems
description: Comprehensive design system guidelines for building consistent, accessible, and scalable digital products
---

# Design Systems Best Practices

You are an expert in UI and UX design principles for software development. Apply these guidelines when creating or maintaining design systems.

## Foundation Elements

### Color System

- Define primary, secondary, and accent colors
- Include semantic colors for success, warning, error, info states
- Ensure all color combinations meet WCAG contrast requirements
- Document color usage guidelines and contexts
- Provide light and dark mode variants

### Typography

- Establish a type scale with consistent ratios
- Define font families for headings and body text
- Set line heights and letter spacing standards
- Document font weights and their usage
- Ensure readability across screen sizes

### Spacing System

- Define consistent spacing scale (4px, 8px, 16px, 24px, etc.)
- Create layout primitives for common patterns
- Document margin and padding conventions
- Ensure responsive spacing behavior
- Use CSS custom properties for maintainability

### Icons and Imagery

- Maintain consistent icon style and sizing
- Define icon grid and stroke weights
- Document icon naming conventions
- Optimize assets for web performance
- Provide multiple formats when needed (SVG, PNG)

## Component Architecture

### Component Structure

- Create atomic, reusable components
- Define clear component APIs (props/attributes)
- Document variants and states
- Ensure components are accessible by default
- Provide clear naming conventions

### Component States

- Default state
- Hover state
- Focus state (keyboard navigation)
- Active/pressed state
- Disabled state
- Loading state
- Error state

### Component Variants

- Size variants (small, medium, large)
- Color/theme variants
- Layout variants
- Contextual variants

## Accessibility Requirements

- Follow WCAG 2.1 AA guidelines minimum
- Use semantic HTML elements
- Provide ARIA labels where needed
- Ensure keyboard navigation
- Test with screen readers
- Maintain color contrast ratios
- Support reduced motion preferences

## Documentation Standards

### Component Documentation

- Purpose and use cases
- Props/API reference
- Code examples
- Do's and don'ts
- Accessibility notes
- Related components

### Pattern Documentation

- When to use
- Anatomy breakdown
- Behavior specifications
- Responsive considerations
- Edge cases

## Implementation Guidelines

### CSS Architecture

- Use CSS custom properties for tokens
- Implement utility classes for common patterns
- Follow BEM or similar naming convention
- Ensure specificity is manageable
- Support theming and customization

### Component Libraries

- Framework-agnostic when possible
- Tree-shakeable exports
- TypeScript support
- Comprehensive test coverage
- Storybook integration

## Governance

### Contribution Guidelines

- How to propose new components
- Review and approval process
- Versioning strategy
- Breaking change policy
- Deprecation process

### Maintenance

- Regular accessibility audits
- Performance monitoring
- Browser compatibility testing
- Documentation updates
- Community feedback incorporation

## Design Tokens

### Token Categories

- Colors
- Typography (font sizes, weights, line heights)
- Spacing
- Border radius
- Shadows
- Breakpoints
- Animation durations
- Z-index values

### Token Implementation

```css
:root {
  /* Colors */
  --color-primary-500: #0066cc;
  --color-neutral-100: #f5f5f5;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-4: 16px;

  /* Typography */
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

## Quality Assurance

- Visual regression testing
- Accessibility automated testing
- Cross-browser testing
- Performance benchmarking
- Component unit testing
- Integration testing

Stay current with design system practices and industry standards.
