---
name: ghost
description: Ghost CMS theme development with Handlebars templating, Alpine.js, Tailwind CSS, and performance optimization
---

# Ghost CMS Theme Development

You are an expert in Ghost CMS theme development, Handlebars templating, and modern frontend technologies.

## Core Principles

- Write semantic, accessible HTML
- Use Handlebars helpers effectively
- Optimize for performance and SEO
- Follow Ghost theme development best practices
- Create responsive, mobile-first designs

## Project Structure

```
theme/
├── assets/
│   ├── css/
│   │   └── screen.css
│   ├── js/
│   │   └── main.js
│   └── images/
├── partials/
│   ├── header.hbs
│   ├── footer.hbs
│   └── post-card.hbs
├── default.hbs
├── index.hbs
├── post.hbs
├── page.hbs
├── tag.hbs
├── author.hbs
├── error.hbs
└── package.json
```

## Handlebars Templating

### Basic Template Structure

```handlebars
{{!< default}}

<main class="site-content">
  {{#foreach posts}}
    {{> post-card}}
  {{/foreach}}

  {{pagination}}
</main>
```

### Default Layout (default.hbs)

```handlebars
<!DOCTYPE html>
<html lang="{{@site.locale}}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{meta_title}}</title>

  {{ghost_head}}

  <link rel="stylesheet" href="{{asset "css/screen.css"}}">
</head>
<body class="{{body_class}}">

  {{> header}}

  {{{body}}}

  {{> footer}}

  {{ghost_foot}}

  <script src="{{asset "js/main.js"}}"></script>
</body>
</html>
```

### Partials

```handlebars
{{!-- partials/post-card.hbs --}}
<article class="post-card {{post_class}}">
  {{#if feature_image}}
    <a href="{{url}}" class="post-card-image-link">
      <img
        class="post-card-image"
        src="{{img_url feature_image size="m"}}"
        alt="{{title}}"
        loading="lazy"
      >
    </a>
  {{/if}}

  <div class="post-card-content">
    <h2 class="post-card-title">
      <a href="{{url}}">{{title}}</a>
    </h2>

    {{#if excerpt}}
      <p class="post-card-excerpt">{{excerpt words="30"}}</p>
    {{/if}}

    <footer class="post-card-meta">
      <time datetime="{{date format="YYYY-MM-DD"}}">
        {{date format="D MMM YYYY"}}
      </time>
      <span class="reading-time">{{reading_time}}</span>
    </footer>
  </div>
</article>
```

## Ghost Helpers

### Content Helpers

```handlebars
{{!-- Post content --}}
{{content}}

{{!-- Excerpt with word limit --}}
{{excerpt words="50"}}

{{!-- Reading time --}}
{{reading_time}}

{{!-- Featured image with responsive sizes --}}
{{img_url feature_image size="l"}}

{{!-- Date formatting --}}
{{date format="MMMM D, YYYY"}}
```

### Conditional Helpers

```handlebars
{{#is "home"}}
  {{!-- Home page content --}}
{{/is}}

{{#is "post"}}
  {{!-- Single post content --}}
{{/is}}

{{#has tag="featured"}}
  <span class="featured-badge">Featured</span>
{{/has}}

{{#if @member}}
  <p>Welcome, {{@member.name}}!</p>
{{/if}}
```

### Loop Helpers

```handlebars
{{#foreach posts}}
  {{!-- Access loop variables --}}
  {{#if @first}}<div class="first-post">{{/if}}
  {{> post-card}}
  {{#if @first}}</div>{{/if}}
{{/foreach}}

{{!-- Get posts with specific tag --}}
{{#get "posts" filter="tag:featured" limit="3"}}
  {{#foreach posts}}
    {{> post-card}}
  {{/foreach}}
{{/get}}
```

## Tailwind CSS Integration

### Setup

```javascript
// tailwind.config.js
module.exports = {
  content: ['./**/*.hbs'],
  theme: {
    extend: {
      colors: {
        ghost: {
          accent: 'var(--ghost-accent-color)',
        },
      },
    },
  },
};
```

### Using Ghost Accent Color

```css
:root {
  --ghost-accent-color: {{@site.accent_color}};
}

.accent-bg {
  background-color: var(--ghost-accent-color);
}
```

## Alpine.js Integration

```handlebars
<div x-data="{ open: false }">
  <button @click="open = !open">Toggle Menu</button>

  <nav x-show="open" x-transition>
    {{navigation}}
  </nav>
</div>
```

## Membership Integration

```handlebars
{{#if @member}}
  {{#if @member.paid}}
    {{!-- Premium content --}}
    {{content}}
  {{else}}
    {{!-- Free member content --}}
    <p>Upgrade to access premium content</p>
  {{/if}}
{{else}}
  {{!-- Public content --}}
  <a href="#/portal/signup">Subscribe</a>
{{/if}}
```

## SEO and Performance

### Meta Tags

```handlebars
<head>
  {{!-- Ghost handles meta via ghost_head --}}
  {{ghost_head}}

  {{!-- Custom structured data --}}
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "{{@site.title}}",
    "url": "{{@site.url}}"
  }
  </script>
</head>
```

### Image Optimization

```handlebars
{{!-- Responsive images --}}
<img
  srcset="
    {{img_url feature_image size="s"}} 300w,
    {{img_url feature_image size="m"}} 600w,
    {{img_url feature_image size="l"}} 1000w
  "
  sizes="(max-width: 600px) 300px, (max-width: 1000px) 600px, 1000px"
  src="{{img_url feature_image size="m"}}"
  alt="{{title}}"
  loading="lazy"
>
```

## Package.json Configuration

```json
{
  "name": "theme-name",
  "version": "1.0.0",
  "engines": {
    "ghost": ">=5.0.0"
  },
  "config": {
    "posts_per_page": 10,
    "image_sizes": {
      "s": { "width": 300 },
      "m": { "width": 600 },
      "l": { "width": 1000 },
      "xl": { "width": 2000 }
    }
  }
}
```

## Testing

- Use gscan to validate theme
- Test across different Ghost versions
- Check responsive behavior
- Validate membership features
- Test with various content types
