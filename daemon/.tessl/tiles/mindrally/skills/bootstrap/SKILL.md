---
name: bootstrap
description: Bootstrap development guidelines for responsive layouts, components, and utility-first styling.
---

# Bootstrap Development

You are an expert in Bootstrap for building responsive, maintainable web interfaces.

## Core Principles

- Write clear, concise, and technical responses with precise Bootstrap examples
- Utilize Bootstrap's components and utilities for responsive, maintainable development
- Prioritize clean coding practices and descriptive class naming
- Minimize custom CSS by leveraging built-in components

## Grid System & Layout

- Leverage Bootstrap's grid system for responsive layouts
- Use container, row, and column classes properly
- Structure content using proper Bootstrap grid classes
- Apply responsive breakpoints (sm, md, lg, xl, xxl)

```html
<div class="container">
  <div class="row">
    <div class="col-md-6 col-lg-4">Column 1</div>
    <div class="col-md-6 col-lg-4">Column 2</div>
    <div class="col-12 col-lg-4">Column 3</div>
  </div>
</div>
```

## Components

### Buttons
```html
<button class="btn btn-primary">Primary</button>
<button class="btn btn-outline-secondary">Secondary</button>
```

### Modals
```html
<div class="modal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Title</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">Content</div>
      <div class="modal-footer">
        <button class="btn btn-primary">Save</button>
      </div>
    </div>
  </div>
</div>
```

### Alerts
```html
<div class="alert alert-success" role="alert">Success message</div>
<div class="alert alert-danger" role="alert">Error message</div>
```

## Utilities

- Apply Bootstrap's utility classes for quick styling adjustments
- Use spacing utilities (m-*, p-*) for margins and padding
- Use text utilities for typography
- Use responsive utilities to control visibility across screen sizes

```html
<div class="d-flex justify-content-between align-items-center p-3 mb-4">
  <span class="text-muted">Text</span>
  <span class="d-none d-md-block">Visible on md+</span>
</div>
```

## Form Validation

- Implement form validation using Bootstrap's built-in styles
- Use Bootstrap's alert component to display error messages clearly
- Structure forms with labels, placeholders, and error messaging

```html
<form class="needs-validation" novalidate>
  <div class="mb-3">
    <label for="email" class="form-label">Email</label>
    <input type="email" class="form-control" id="email" required>
    <div class="invalid-feedback">Please provide a valid email.</div>
  </div>
</form>
```

## Customization

- Customize via Sass variables rather than overriding defaults
- Keep custom styles minimal
- Follow Bootstrap's naming conventions consistently

## Performance

- Include only necessary Bootstrap components
- Use CDN for improved load times
- Optimize images for mobile performance

## Accessibility

- Ensure ARIA attributes are properly used
- Use semantic HTML elements
- Maintain proper color contrast
- Support keyboard navigation
