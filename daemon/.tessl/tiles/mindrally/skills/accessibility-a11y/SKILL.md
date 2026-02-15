---
name: accessibility-a11y
description: Implement web accessibility (a11y) best practices following WCAG guidelines to create inclusive, accessible user interfaces.
---

# Accessibility (a11y) Best Practices

You are an expert in web accessibility and inclusive design. Apply these guidelines to ensure all users can access and interact with web applications regardless of their abilities.

## Core Accessibility Principles

- Follow WCAG (Web Content Accessibility Guidelines) standards
- Use semantic HTML to improve accessibility and screen reader compatibility
- Ensure high accessibility standards using ARIA roles and native accessibility props
- Design for all users including those with visual, auditory, motor, and cognitive disabilities
- Test with various assistive technologies

## Semantic HTML

### Structural Elements
- Use semantic elements like `<header>`, `<main>`, `<footer>`, `<nav>`, `<article>`, `<section>`, `<aside>`
- Employ `<button>` for interactive elements, not `<div>` or `<span>`
- Use proper heading hierarchy (h1-h6) without skipping levels
- Use landmarks (e.g., `<nav>`, `<main>`, `<aside>`) for screen reader navigation
- Avoid deprecated markup

### Form Accessibility
- Associate labels with form inputs using `for` and `id` attributes
- Group related form elements with `<fieldset>` and `<legend>`
- Provide clear error messages and validation feedback
- Use appropriate input types (email, tel, number, etc.)
- Include placeholder text as supplementary hints, not replacements for labels

## ARIA Implementation

### When to Use ARIA
- Use ARIA roles and attributes to enhance accessibility where semantic HTML is insufficient
- Prefer native HTML elements over ARIA when possible
- Use `aria-label` for elements without visible text labels
- Implement `aria-describedby` for additional context
- Use `aria-live` regions for dynamic content updates

### Common ARIA Patterns
- Use `role="button"` only when a non-button element must act as a button
- Implement `aria-expanded` for collapsible content
- Use `aria-hidden="true"` for decorative elements
- Apply `aria-current="page"` for navigation highlighting
- Use `aria-labelledby` to reference visible labels

## Visual Accessibility

### Color and Contrast
- Ensure sufficient color contrast for text (minimum 4.5:1 for normal text, 3:1 for large text)
- Never use color as the only means of conveying information
- Provide alternative indicators (icons, patterns, text) alongside color
- Test designs with color blindness simulators

### Focus Management
- Use focus styles to indicate focus state clearly
- Ensure visible focus indicators on all interactive elements
- Manage focus appropriately when content changes dynamically
- Avoid removing outline styles without providing alternatives
- Implement logical tab order

## Keyboard Navigation

### Navigation Requirements
- Provide keyboard navigation for all interactive elements
- Ensure all functionality is accessible via keyboard alone
- Use tabindex appropriately (0 for natural order, -1 for programmatic focus)
- Implement keyboard shortcuts for complex interactions
- Avoid keyboard traps

### Interactive Elements
- Ensure interactive elements are large enough for touch (minimum 44x44 pixels)
- Implement keyboard event handlers (`onKeyDown`, `onKeyPress`) alongside click handlers
- Support Enter and Space keys for activating buttons
- Implement arrow key navigation for complex widgets

## Content Accessibility

### Images and Media
- Ensure all images have descriptive alt text
- Use empty alt="" for decorative images
- Provide captions for videos
- Include transcripts for audio content
- Use descriptive link text (avoid "click here")

### Text and Typography
- Use relative units (rem, em) for typography
- Ensure text can be resized up to 200% without loss of functionality
- Maintain adequate line height and letter spacing
- Avoid justified text which can create uneven spacing
- Support user preferences for reduced motion

## Responsive and Adaptive Design

### Mobile-First Approach
- Design mobile-first, then scale upward
- Implement responsive layouts that work across devices
- Ensure touch targets are appropriately sized
- Support both portrait and landscape orientations

### User Preferences
- Respect `prefers-reduced-motion` for animations
- Support `prefers-color-scheme` for dark/light modes
- Consider `prefers-contrast` for high contrast needs
- Implement `prefers-reduced-transparency` when applicable

## Testing and Validation

### Automated Testing
- Use tools like Lighthouse for accessibility audits
- Integrate axe-core for automated accessibility testing
- Run accessibility checks in CI/CD pipelines
- Address all critical and serious accessibility issues

### Manual Testing
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Navigate entirely by keyboard
- Test with browser zoom at 200%
- Use browser accessibility inspection tools
- Test with actual users who have disabilities when possible

## CSS Best Practices for Accessibility

- Use external stylesheets; avoid inline styles for maintainability
- Leverage Flexbox and Grid for robust layouts
- Use class selectors for styling (BEM naming methodology recommended)
- Implement responsive design with media queries
- Ensure hover states also have focus equivalents
