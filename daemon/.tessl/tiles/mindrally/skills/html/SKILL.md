---
name: html
description: Guidelines for semantic HTML markup, document structure, forms, accessibility attributes, and modern HTML best practices
---

# HTML Development Guidelines

## Core Principles

- Write semantic HTML to improve accessibility and SEO
- Use appropriate elements for their intended purpose
- Ensure proper document structure and hierarchy
- Prioritize accessibility by using ARIA roles and attributes when needed

## Semantic Elements

### Document Structure
- Use `<header>` for introductory content and navigation
- Use `<main>` for the primary content (one per page)
- Use `<footer>` for footer content
- Use `<nav>` for navigation sections
- Use `<aside>` for tangentially related content

### Content Sections
- Use `<article>` for self-contained, distributable content
- Use `<section>` for thematic grouping of content
- Use appropriate heading hierarchy (`<h1>` through `<h6>`)
- Only one `<h1>` per page, representing the main topic

### Text Content
- Use `<p>` for paragraphs
- Use `<ul>`, `<ol>`, `<dl>` for lists appropriately
- Use `<blockquote>` for quotations
- Use `<figure>` and `<figcaption>` for illustrations

## Interactive Elements

### Buttons and Links
- Use `<button>` for clickable actions that don't navigate
- Use `<a>` for links that navigate to URLs
- Always include `href` attribute on links
- Never use `<div>` or `<span>` for clickable elements

### Forms
- Use `<form>` with proper `action` and `method` attributes
- Associate labels with inputs using `for` attribute
- Use appropriate input types (`email`, `tel`, `number`, etc.)
- Group related inputs with `<fieldset>` and `<legend>`
- Include validation attributes (`required`, `pattern`, `min`, `max`)

## Media Elements

### Images
- Always include `alt` attribute for images
- Use descriptive alt text for informational images
- Use empty `alt=""` for decorative images
- Use `srcset` and `sizes` for responsive images
- Include `width` and `height` to prevent layout shift

### Video and Audio
- Provide captions and transcripts
- Include multiple source formats for compatibility
- Use `poster` attribute for video thumbnails
- Consider autoplay impact on user experience

## Accessibility (ARIA)

### When to Use ARIA
- Use ARIA when native HTML semantics are insufficient
- Prefer native HTML elements over ARIA when possible
- Ensure ARIA attributes match actual element behavior

### Common ARIA Attributes
- `aria-label` for accessible names
- `aria-describedby` for additional descriptions
- `aria-hidden` for decorative elements
- `aria-expanded` for expandable sections
- `aria-live` for dynamic content updates

### Landmarks
- Use landmark roles to define page regions
- Ensure all content is within a landmark
- Use `role="main"`, `role="navigation"`, etc., only when semantic elements aren't available

## Best Practices

### Document Meta
- Include proper `<!DOCTYPE html>` declaration
- Set language attribute on `<html>` element
- Include viewport meta tag for responsive design
- Use appropriate meta tags for SEO

### Code Quality
- Validate HTML using W3C validator
- Maintain consistent indentation
- Close all tags properly (including self-closing)
- Use lowercase for element names and attributes

### Deprecated Elements
- Avoid `<font>`, `<center>`, `<b>`, `<i>` for styling
- Use CSS for visual presentation
- Use `<strong>` and `<em>` for semantic emphasis

## HTMX Integration

When using HTMX for interactivity:
- Use `hx-get`, `hx-post` attributes for server requests
- Leverage `hx-target` to specify update targets
- Use `hx-swap` to control how content is inserted
- Implement `hx-confirm` for critical actions
- Use `hx-push-url` for URL updates without full refresh

## Bootstrap Integration

When using Bootstrap:
- Leverage Bootstrap's grid system for layouts
- Use Bootstrap components with proper markup structure
- Include necessary ARIA attributes with components
- Use Bootstrap's utility classes for spacing and typography
- Minimize custom CSS by using Bootstrap classes

## Performance

- Minimize DOM depth and complexity
- Load scripts with `defer` or `async` when appropriate
- Use `loading="lazy"` for below-fold images
- Preload critical resources with `<link rel="preload">`
