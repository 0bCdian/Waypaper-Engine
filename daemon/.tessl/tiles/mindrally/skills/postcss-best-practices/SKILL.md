---
name: postcss-best-practices
description: PostCSS best practices and configuration guidelines for modern CSS processing and optimization
---

# PostCSS Best Practices

You are an expert in PostCSS, CSS processing pipelines, and modern CSS tooling.

## Key Principles

- Use PostCSS as a modular CSS processor with purpose-specific plugins
- Write future-proof CSS using modern syntax with appropriate transpilation
- Optimize CSS output for production with minification and autoprefixing
- Keep plugin configurations minimal and purposeful

## What is PostCSS

PostCSS is a tool for transforming CSS with JavaScript plugins. Unlike preprocessors (Sass/Less), PostCSS:
- Is modular - add only the features you need
- Can parse and transform standard CSS
- Enables future CSS syntax today
- Optimizes and minifies output
- Works with any build tool

## Project Setup

### Installation
```bash
# Core PostCSS
npm install postcss postcss-cli --save-dev

# Common plugins
npm install autoprefixer cssnano postcss-preset-env --save-dev

# Optional plugins
npm install postcss-import postcss-nested postcss-custom-media --save-dev
```

### Configuration File
```javascript
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-import'),
    require('postcss-preset-env')({
      stage: 2,
      features: {
        'nesting-rules': true,
        'custom-media-queries': true,
        'custom-properties': true,
      },
    }),
    require('autoprefixer'),
    require('cssnano')({
      preset: ['default', {
        discardComments: { removeAll: true },
      }],
    }),
  ],
};
```

### Build Tool Integration

#### Webpack
```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader',
        ],
      },
    ],
  },
};
```

#### Vite
```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    postcss: './postcss.config.js',
  },
});
```

#### Next.js
```javascript
// postcss.config.js (auto-detected)
module.exports = {
  plugins: {
    'postcss-import': {},
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

## Essential Plugins

### postcss-preset-env

Enables modern CSS features with polyfills:

```javascript
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-preset-env')({
      stage: 2, // Stage 2 features are stable
      features: {
        'nesting-rules': true,
        'custom-media-queries': true,
        'custom-selectors': true,
        'gap-properties': true,
        'logical-properties-and-values': true,
      },
      autoprefixer: { grid: true },
      browsers: 'last 2 versions',
    }),
  ],
};
```

### autoprefixer

Adds vendor prefixes automatically:

```javascript
// postcss.config.js
module.exports = {
  plugins: [
    require('autoprefixer')({
      grid: 'autoplace', // Enable grid prefixes
      flexbox: true,
    }),
  ],
};

// Input CSS
.element {
  display: flex;
  user-select: none;
}

// Output CSS
.element {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-user-select: none;
     -moz-user-select: none;
      -ms-user-select: none;
          user-select: none;
}
```

### cssnano

Minifies and optimizes CSS for production:

```javascript
// postcss.config.js
const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  plugins: [
    require('autoprefixer'),
    isProduction && require('cssnano')({
      preset: ['default', {
        discardComments: { removeAll: true },
        normalizeWhitespace: true,
        minifyFontValues: true,
        minifyGradients: true,
        reduceIdents: false, // Preserve animation names
        mergeRules: true,
        mergeLonghand: true,
      }],
    }),
  ].filter(Boolean),
};
```

### postcss-import

Inline @import statements:

```javascript
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-import')({
      path: ['src/styles'],
    }),
  ],
};
```

```css
/* main.css */
@import 'variables.css';
@import 'base.css';
@import 'components/buttons.css';
@import 'components/cards.css';
```

### postcss-nested

Enables Sass-like nesting:

```javascript
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-nested'),
  ],
};
```

```css
/* Input */
.card {
  background: white;

  &__header {
    padding: 16px;
  }

  &__body {
    padding: 16px;
  }

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  @media (min-width: 768px) {
    display: flex;
  }
}

/* Output */
.card {
  background: white;
}
.card__header {
  padding: 16px;
}
.card__body {
  padding: 16px;
}
.card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
@media (min-width: 768px) {
  .card {
    display: flex;
  }
}
```

## Modern CSS Features

### CSS Nesting (Native)
```css
/* Modern browsers support native nesting */
.card {
  background: white;
  border-radius: 8px;

  & .card-header {
    padding: 1rem;
    border-bottom: 1px solid #eee;
  }

  & .card-body {
    padding: 1rem;
  }

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  @media (min-width: 768px) {
    display: flex;
  }
}
```

### Custom Properties (CSS Variables)
```css
:root {
  /* Colors */
  --color-primary: #3498db;
  --color-primary-light: color-mix(in srgb, var(--color-primary), white 20%);
  --color-primary-dark: color-mix(in srgb, var(--color-primary), black 20%);
  --color-text: #333333;
  --color-background: #ffffff;
  --color-border: #e0e0e0;

  /* Typography */
  --font-family-base: 'Helvetica Neue', Arial, sans-serif;
  --font-size-base: 1rem;
  --line-height-base: 1.5;

  /* Spacing */
  --spacing-unit: 8px;
  --spacing-sm: calc(var(--spacing-unit) * 1);
  --spacing-md: calc(var(--spacing-unit) * 2);
  --spacing-lg: calc(var(--spacing-unit) * 3);
  --spacing-xl: calc(var(--spacing-unit) * 4);

  /* Transitions */
  --transition-base: 0.3s ease;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.button {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary);
  color: white;
  transition: background var(--transition-base);
}

.button:hover {
  background: var(--color-primary-dark);
}
```

### Custom Media Queries
```css
/* Define custom media queries */
@custom-media --viewport-sm (min-width: 576px);
@custom-media --viewport-md (min-width: 768px);
@custom-media --viewport-lg (min-width: 992px);
@custom-media --viewport-xl (min-width: 1200px);

@custom-media --motion-ok (prefers-reduced-motion: no-preference);
@custom-media --dark-mode (prefers-color-scheme: dark);

/* Usage */
.element {
  width: 100%;
}

@media (--viewport-md) {
  .element {
    width: 50%;
  }
}

@media (--viewport-lg) {
  .element {
    width: 33.333%;
  }
}

@media (--motion-ok) {
  .element {
    transition: transform 0.3s ease;
  }
}
```

### Custom Selectors
```css
/* Define reusable selectors */
@custom-selector :--heading h1, h2, h3, h4, h5, h6;
@custom-selector :--button button, [type="button"], [type="submit"];
@custom-selector :--enter :hover, :focus;

/* Usage */
:--heading {
  font-family: var(--font-family-heading);
  line-height: 1.2;
  margin-bottom: 1rem;
}

:--button {
  cursor: pointer;
  font-family: inherit;
}

.link:--enter {
  color: var(--color-primary);
  text-decoration: underline;
}
```

### Logical Properties
```css
/* Use logical properties for internationalization */
.element {
  /* Instead of margin-left/right */
  margin-inline: auto;

  /* Instead of padding-top/bottom */
  padding-block: var(--spacing-md);

  /* Instead of width/height */
  inline-size: 100%;
  block-size: auto;

  /* Instead of border-left */
  border-inline-start: 2px solid var(--color-primary);

  /* Instead of text-align: left */
  text-align: start;
}
```

### Container Queries
```css
/* Modern container queries */
.card-container {
  container-type: inline-size;
  container-name: card;
}

.card {
  display: block;
}

@container card (min-width: 400px) {
  .card {
    display: flex;
  }
}

@container card (min-width: 600px) {
  .card {
    gap: 2rem;
  }
}
```

## File Organization

### Structure
```
src/
├── styles/
│   ├── base/
│   │   ├── reset.css
│   │   ├── typography.css
│   │   └── base.css
│   ├── components/
│   │   ├── buttons.css
│   │   ├── cards.css
│   │   ├── forms.css
│   │   └── navigation.css
│   ├── layout/
│   │   ├── header.css
│   │   ├── footer.css
│   │   └── grid.css
│   ├── utilities/
│   │   ├── spacing.css
│   │   ├── colors.css
│   │   └── display.css
│   ├── variables.css
│   └── main.css
├── postcss.config.js
└── package.json
```

### Main Entry Point
```css
/* main.css */

/* Variables first */
@import 'variables.css';

/* Reset and base styles */
@import 'base/reset.css';
@import 'base/typography.css';
@import 'base/base.css';

/* Layout */
@import 'layout/grid.css';
@import 'layout/header.css';
@import 'layout/footer.css';

/* Components */
@import 'components/buttons.css';
@import 'components/cards.css';
@import 'components/forms.css';
@import 'components/navigation.css';

/* Utilities (last for specificity) */
@import 'utilities/spacing.css';
@import 'utilities/colors.css';
@import 'utilities/display.css';
```

## Production Configuration

### Environment-Based Config
```javascript
// postcss.config.js
const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  plugins: [
    // Always run these
    require('postcss-import'),
    require('postcss-preset-env')({
      stage: 2,
      features: {
        'nesting-rules': true,
        'custom-media-queries': true,
      },
    }),
    require('autoprefixer'),

    // Production only
    isProduction && require('cssnano')({
      preset: ['default', {
        discardComments: { removeAll: true },
        reduceIdents: false,
        zindex: false,
      }],
    }),

    isProduction && require('@fullhuman/postcss-purgecss')({
      content: [
        './src/**/*.html',
        './src/**/*.js',
        './src/**/*.jsx',
        './src/**/*.tsx',
      ],
      safelist: {
        standard: [/^is-/, /^has-/, /^js-/],
        deep: [/modal/, /tooltip/],
      },
    }),
  ].filter(Boolean),
};
```

### Browser Support
```javascript
// package.json
{
  "browserslist": [
    "> 1%",
    "last 2 versions",
    "not dead",
    "not ie 11"
  ]
}

// Or .browserslistrc
> 1%
last 2 versions
not dead
not ie 11
```

## Useful Plugin Configurations

### postcss-custom-media
```javascript
require('postcss-custom-media')({
  importFrom: [
    {
      customMedia: {
        '--viewport-sm': '(min-width: 576px)',
        '--viewport-md': '(min-width: 768px)',
        '--viewport-lg': '(min-width: 992px)',
        '--viewport-xl': '(min-width: 1200px)',
      },
    },
  ],
});
```

### postcss-mixins
```javascript
require('postcss-mixins')({
  mixins: {
    'flex-center': {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
    },
    'visually-hidden': {
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
    },
  },
});
```

### postcss-simple-vars
```javascript
require('postcss-simple-vars')({
  variables: {
    'color-primary': '#3498db',
    'spacing-unit': '8px',
  },
});
```

## Performance Tips

- Order plugins correctly: import, preset-env/nesting, autoprefixer, cssnano
- Use PurgeCSS to remove unused styles in production
- Enable source maps only in development
- Cache PostCSS results in build tools when possible
- Avoid unnecessary plugins - each adds processing time
- Use browserslist to target only necessary browsers

## Common Plugin Combinations

### Minimal Setup
```javascript
module.exports = {
  plugins: [
    require('autoprefixer'),
    require('cssnano'),
  ],
};
```

### Modern CSS Features
```javascript
module.exports = {
  plugins: [
    require('postcss-import'),
    require('postcss-preset-env')({ stage: 2 }),
    require('autoprefixer'),
    require('cssnano'),
  ],
};
```

### Sass-like Features
```javascript
module.exports = {
  plugins: [
    require('postcss-import'),
    require('postcss-mixins'),
    require('postcss-simple-vars'),
    require('postcss-nested'),
    require('autoprefixer'),
    require('cssnano'),
  ],
};
```

### With Tailwind CSS
```javascript
module.exports = {
  plugins: {
    'postcss-import': {},
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {}),
  },
};
```

## Debugging

### Enable Source Maps
```javascript
// postcss.config.js
module.exports = {
  map: process.env.NODE_ENV !== 'production'
    ? { inline: false }
    : false,
  plugins: [
    // ...plugins
  ],
};
```

### Verbose Output
```bash
# CLI with verbose output
postcss src/main.css -o dist/main.css --verbose
```

### Check Plugin Order
If styles aren't working as expected:
1. Check plugin order (import before others)
2. Verify preset-env stage settings
3. Check browserslist configuration
4. Review cssnano options (may be over-optimizing)
