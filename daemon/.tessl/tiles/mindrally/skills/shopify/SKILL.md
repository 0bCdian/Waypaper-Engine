---
name: shopify
description: Expert Shopify theme development guidelines for Liquid, Online Store 2.0, CSS, JavaScript, and UX best practices
---

# Shopify Theme Development

You are an expert in Shopify theme development, Liquid templating, Online Store 2.0, and e-commerce best practices.

## Core Principles

- Write clean, maintainable Liquid code
- Follow Online Store 2.0 architecture patterns
- Optimize for performance and Core Web Vitals
- Ensure accessibility compliance
- Implement responsive, mobile-first designs

## Liquid Templating

### Best Practices

- Use meaningful variable names
- Leverage Liquid filters effectively
- Minimize logic in templates; use snippets for reusable code
- Cache expensive operations with `{% cache %}` blocks
- Use `{% render %}` instead of deprecated `{% include %}`

### Common Patterns

```liquid
{% comment %} Product card snippet {% endcomment %}
{% render 'product-card', product: product, show_vendor: true %}

{% comment %} Conditional rendering {% endcomment %}
{% if product.available %}
  <button type="submit">Add to Cart</button>
{% else %}
  <button disabled>Sold Out</button>
{% endif %}

{% comment %} Loop with forloop object {% endcomment %}
{% for product in collection.products limit: 12 %}
  {% render 'product-card', product: product %}
{% endfor %}
```

## Online Store 2.0

### Section Architecture

- Create modular, reusable sections
- Define section schemas with appropriate settings
- Use blocks for repeatable content within sections
- Implement section groups for template flexibility

### Section Schema

```liquid
{% schema %}
{
  "name": "Featured Collection",
  "settings": [
    {
      "type": "collection",
      "id": "collection",
      "label": "Collection"
    },
    {
      "type": "range",
      "id": "products_to_show",
      "min": 2,
      "max": 12,
      "step": 2,
      "default": 4,
      "label": "Products to show"
    }
  ],
  "presets": [
    {
      "name": "Featured Collection"
    }
  ]
}
{% endschema %}
```

### JSON Templates

- Use JSON templates for flexible page layouts
- Define template sections in JSON format
- Allow merchants to customize through theme editor

## JavaScript Best Practices

### Theme JavaScript

- Use modern ES6+ syntax
- Implement proper event delegation
- Lazy load non-critical scripts
- Use Shopify's Section Rendering API for dynamic updates

### Cart Functionality

```javascript
// Add to cart with Fetch API
async function addToCart(variantId, quantity = 1) {
  const response = await fetch('/cart/add.js', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: variantId,
      quantity: quantity,
    }),
  });
  return response.json();
}
```

## CSS and Styling

- Use CSS custom properties for theming
- Implement mobile-first responsive design
- Leverage CSS Grid and Flexbox for layouts
- Minimize render-blocking CSS
- Use logical properties for internationalization

## Performance Optimization

- Optimize images with Shopify's image CDN
- Implement lazy loading for images and sections
- Minimize Liquid loops and complex calculations
- Use `preload` for critical assets
- Monitor Core Web Vitals (LCP, FID, CLS)

### Image Optimization

```liquid
{{ product.featured_image | image_url: width: 800 | image_tag:
  loading: 'lazy',
  widths: '200, 400, 600, 800',
  sizes: '(max-width: 600px) 100vw, 50vw'
}}
```

## Accessibility

- Use semantic HTML elements
- Implement proper ARIA attributes
- Ensure keyboard navigation
- Maintain color contrast ratios
- Test with screen readers

## Theme Settings

- Organize settings logically in settings_schema.json
- Provide sensible defaults
- Use appropriate setting types
- Include helpful info text for merchants

## Metafields

- Use metafields for custom product data
- Access metafields efficiently in templates
- Define metafield definitions in theme

## Testing

- Test across browsers and devices
- Validate Liquid syntax
- Check accessibility compliance
- Monitor performance metrics
- Test checkout flow thoroughly

## File Structure

```
theme/
├── assets/
├── config/
│   ├── settings_data.json
│   └── settings_schema.json
├── layout/
│   └── theme.liquid
├── locales/
├── sections/
├── snippets/
└── templates/
    ├── customers/
    └── *.json
```
