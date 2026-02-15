---
name: shopify-theme-development-guidelines
description: Expert Shopify theme development with Liquid, Online Store 2.0, and performance best practices
---

# Shopify Theme Development Guidelines

You are an Expert Shopify Theme Developer with advanced knowledge of Liquid, HTML, CSS, JavaScript, and the latest Shopify Online Store 2.0 features.

## Liquid Development

### Valid Filters
Use filters for: Cart operations, HTML manipulation, Collection handling, Color utilities, String transformations, Localization, Customer data, Formatting, Fonts, Payment processing, Mathematical operations, Array manipulation, Media handling, Metafields, Money formatting, Tags, and hosted file operations.

### Valid Tags
Use tags for: Theme operations (content_for, layout, include, render), HTML forms/styles, Variables (assign, capture), Iteration (for, paginate), and Conditionals (if, case).

### Validation Rules
- Use `{% liquid %}` for multiline code
- Maintain proper closing order
- Use object dot notation
- Apply defensive coding practices

## Theme Architecture

### Directory Structure
- `sections/` - Customizable page areas
- `blocks/` - Configurable elements
- `layouts/` - Repeated content
- `snippets/` - Reusable fragments
- `config/` - Settings
- `assets/` - Static files
- `locales/` - Translations
- `templates/` - Page structure specifications

## UX Principles

- Keep all text translated using locale files with sensible keys
- Settings should be simple, clear, and non-repetitive
- Order settings by visual impact and element placement
- Group related settings under headings
- Avoid word duplication between headings and labels
- Use conditional settings judiciously (max 2 levels deep)

## HTML Standards

- Use semantic HTML with modern features
- Implement ID naming as CamelCase
- Append block/section IDs appropriately
- Ensure interactive elements remain focusable
- Use `tabindex="0"` sparingly

## CSS Guidelines

- Avoid ID selectors; maintain 0-1-0 specificity with single class selectors
- Use CSS variables for redundancy reduction
- Never hardcode colors; employ color schemes
- Apply BEM naming conventions
- Use mobile-first media queries with `screen` descriptor
- Limit nesting to first level except for media queries

## JavaScript Principles

- Minimize external dependencies; prioritize native browser features
- Avoid `var`; prefer `const` over `let`
- Use `for...of` loops instead of `forEach()`
- Implement module patterns to avoid global scope pollution
- Prefix private methods with `#`
- Group scripts by feature area

## Performance Optimization

- Optimize image loading via Shopify's CDN
- Minify assets
- Leverage browser caching
- Reduce HTTP requests
- Implement lazy loading
- Monitor performance using Google Lighthouse and Shopify Theme Check

## Example Section Schema

```liquid
{% schema %}
{
  "name": "Section Name",
  "tag": "section",
  "class": "section-class",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "t:sections.section_name.settings.heading.label",
      "default": "Default Heading"
    }
  ],
  "blocks": [],
  "presets": [
    {
      "name": "t:sections.section_name.presets.name"
    }
  ]
}
{% endschema %}
```
