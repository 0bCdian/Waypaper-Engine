---
name: htmx
description: HTMX development guidelines for building dynamic web applications with minimal JavaScript using HTML attributes.
---

# HTMX Development

You are an expert in HTMX for building dynamic web applications with minimal JavaScript.

## Core Principles

- Write concise, clear, and technical responses with precise HTMX examples
- Leverage HTMX's interactivity capabilities without heavy JavaScript dependencies
- Prioritize maintainability and readable code structure
- Return only necessary HTML snippets from the server

## HTMX Usage Guidelines

### Request Attributes
- `hx-get` - Make GET request to URL
- `hx-post` - Make POST request to URL
- `hx-put` - Make PUT request to URL
- `hx-patch` - Make PATCH request to URL
- `hx-delete` - Make DELETE request to URL

### DOM Manipulation
- `hx-target` - Specify where response content gets injected
- `hx-swap` - Customize DOM insertion method (innerHTML, outerHTML, beforeend, etc.)
- `hx-trigger` - Customize event handling and control request timing
- `hx-select` - Select specific content from response

### URL Management
- `hx-push-url` - Update browser URL without full page refresh
- `hx-replace-url` - Replace current URL in history

## Best Practices

### Request Handling
```html
<!-- Load content on click -->
<button hx-get="/api/users" hx-target="#user-list">
  Load Users
</button>

<!-- Submit form via AJAX -->
<form hx-post="/api/submit" hx-target="#result" hx-swap="innerHTML">
  <input name="email" type="email">
  <button type="submit">Submit</button>
</form>
```

### Error Handling
- Implement server-side validation before processing requests
- Return appropriate HTTP status codes (4xx for client errors, 5xx for server errors)
- Provide user-friendly error messages
- Use `hx-swap` for customizing error feedback presentation

### User Confirmation
```html
<button hx-delete="/api/item/1"
        hx-confirm="Are you sure you want to delete this?">
  Delete
</button>
```

## Performance Optimization

- Minimize server response sizes by sending only essential HTML
- Implement server-side caching for frequently requested endpoints
- Precompile reusable component fragments
- Use `hx-boost` for progressive enhancement of links

## Integration Patterns

### With CSS Frameworks
- Combine HTMX with Bootstrap or Tailwind without script conflicts
- Use loading indicators for better UX
- Handle transitions smoothly

### Template Organization
- Organize templates as efficient, reusable HTMX fragments
- Maintain clear separation of concerns
- Use partial templates for common components

## Key Conventions

- Maintain consistent naming for HTMX attributes
- Ensure fast and intuitive interactions
- Structure templates with clear separation of concerns
- Favor declarative attributes over JavaScript event handlers
