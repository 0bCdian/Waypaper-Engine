---
name: less-best-practices
description: Less CSS best practices and coding guidelines for maintainable, modular stylesheets
---

# Less CSS Best Practices

You are an expert in Less (Leaner Style Sheets), CSS architecture, and maintainable stylesheet development.

## Key Principles

- Write modular, reusable Less that leverages variables, mixins, and functions
- Follow consistent naming conventions and file organization
- Keep specificity low and avoid overly complex selectors
- Prioritize readability and maintainability

## File Organization

### Project Structure
```
less/
├── abstracts/
│   ├── variables.less      # Global variables
│   ├── mixins.less         # Reusable mixins
│   └── functions.less      # Less functions
├── base/
│   ├── reset.less          # CSS reset/normalize
│   ├── typography.less     # Typography rules
│   └── base.less           # Base element styles
├── components/
│   ├── buttons.less        # Button components
│   ├── cards.less          # Card components
│   └── forms.less          # Form components
├── layout/
│   ├── header.less         # Header layout
│   ├── footer.less         # Footer layout
│   ├── grid.less           # Grid system
│   └── navigation.less     # Navigation layout
├── pages/
│   ├── home.less           # Home page specific
│   └── contact.less        # Contact page specific
├── themes/
│   └── default.less        # Default theme
├── vendors/
│   └── normalize.less      # Third-party styles
└── main.less               # Main manifest file
```

### Main Manifest
```less
// main.less

// Abstracts
@import "abstracts/variables";
@import "abstracts/mixins";
@import "abstracts/functions";

// Vendors
@import "vendors/normalize";

// Base
@import "base/reset";
@import "base/typography";
@import "base/base";

// Layout
@import "layout/grid";
@import "layout/header";
@import "layout/navigation";
@import "layout/footer";

// Components
@import "components/buttons";
@import "components/cards";
@import "components/forms";

// Pages
@import "pages/home";

// Themes
@import "themes/default";
```

## Variables

### Naming Convention
```less
// variables.less

// Colors - use semantic names
@color-primary: #3498db;
@color-primary-light: lighten(@color-primary, 15%);
@color-primary-dark: darken(@color-primary, 15%);
@color-secondary: #2ecc71;
@color-text: #333333;
@color-text-muted: #666666;
@color-background: #ffffff;
@color-border: #e0e0e0;
@color-error: #e74c3c;
@color-success: #27ae60;
@color-warning: #f39c12;
@color-info: #17a2b8;

// Typography
@font-family-base: 'Helvetica Neue', Arial, sans-serif;
@font-family-heading: 'Georgia', serif;
@font-family-mono: 'Consolas', monospace;
@font-size-base: 1rem;
@font-size-small: 0.875rem;
@font-size-large: 1.25rem;
@font-size-h1: 2.5rem;
@font-size-h2: 2rem;
@font-size-h3: 1.75rem;
@font-weight-normal: 400;
@font-weight-medium: 500;
@font-weight-bold: 700;
@line-height-base: 1.5;
@line-height-heading: 1.2;

// Spacing Scale
@spacing-unit: 8px;
@spacing-xs: (@spacing-unit * 0.5);   // 4px
@spacing-sm: @spacing-unit;            // 8px
@spacing-md: (@spacing-unit * 2);      // 16px
@spacing-lg: (@spacing-unit * 3);      // 24px
@spacing-xl: (@spacing-unit * 4);      // 32px
@spacing-xxl: (@spacing-unit * 6);     // 48px

// Breakpoints
@breakpoint-sm: 576px;
@breakpoint-md: 768px;
@breakpoint-lg: 992px;
@breakpoint-xl: 1200px;
@breakpoint-xxl: 1400px;

// Z-index Scale
@z-index-dropdown: 1000;
@z-index-sticky: 1020;
@z-index-fixed: 1030;
@z-index-modal-backdrop: 1040;
@z-index-modal: 1050;
@z-index-popover: 1060;
@z-index-tooltip: 1070;

// Transitions
@transition-base: 0.3s ease;
@transition-fast: 0.15s ease;
@transition-slow: 0.5s ease;

// Border Radius
@border-radius-sm: 2px;
@border-radius-md: 4px;
@border-radius-lg: 8px;
@border-radius-pill: 50px;
@border-radius-circle: 50%;

// Shadows
@shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
@shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
@shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
@shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);

// Container widths
@container-sm: 540px;
@container-md: 720px;
@container-lg: 960px;
@container-xl: 1140px;
```

### Variable Interpolation
```less
// Use interpolation for dynamic property names
@property: margin;
@position: top;

.element {
  @{property}-@{position}: @spacing-md;
}

// Output: margin-top: 16px;
```

## Mixins

### Basic Mixins
```less
// mixins.less

// Clearfix
.clearfix() {
  &::after {
    content: '';
    display: table;
    clear: both;
  }
}

// Flexbox utilities
.flex-center() {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flex-between() {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.flex-column() {
  display: flex;
  flex-direction: column;
}

// Usage
.container {
  .flex-center();
  min-height: 100vh;
}
```

### Parametric Mixins
```less
// Mixins with parameters
.button-variant(@bg-color, @text-color: white) {
  background-color: @bg-color;
  color: @text-color;
  border: none;

  &:hover {
    background-color: darken(@bg-color, 10%);
  }

  &:active {
    background-color: darken(@bg-color, 15%);
  }

  &:disabled {
    background-color: lighten(@bg-color, 20%);
    cursor: not-allowed;
  }
}

// Usage
.btn-primary {
  .button-variant(@color-primary);
}

.btn-secondary {
  .button-variant(@color-secondary);
}

.btn-danger {
  .button-variant(@color-error);
}
```

### Responsive Mixins
```less
// Media query mixins
.respond-to(@breakpoint, @rules) {
  @media (min-width: @breakpoint) {
    @rules();
  }
}

.respond-below(@breakpoint, @rules) {
  @media (max-width: (@breakpoint - 1px)) {
    @rules();
  }
}

.respond-between(@min, @max, @rules) {
  @media (min-width: @min) and (max-width: (@max - 1px)) {
    @rules();
  }
}

// Usage
.element {
  width: 100%;

  .respond-to(@breakpoint-md, {
    width: 50%;
  });

  .respond-to(@breakpoint-lg, {
    width: 33.333%;
  });
}
```

### Typography Mixins
```less
.font-size(@size, @line-height: @line-height-base) {
  font-size: @size;
  line-height: @line-height;
}

.truncate(@lines: 1) when (@lines = 1) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.truncate(@lines) when (@lines > 1) {
  display: -webkit-box;
  -webkit-line-clamp: @lines;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

// Heading styles
.heading(@size) {
  font-family: @font-family-heading;
  font-size: @size;
  font-weight: @font-weight-bold;
  line-height: @line-height-heading;
  margin-bottom: @spacing-md;
}

// Usage
h1 {
  .heading(@font-size-h1);
}

.card-title {
  .truncate(2);
}
```

### Accessibility Mixins
```less
.visually-hidden() {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.focus-visible() {
  &:focus-visible {
    outline: 2px solid @color-primary;
    outline-offset: 2px;
  }
}

// Usage
.sr-only {
  .visually-hidden();
}

.interactive-element {
  .focus-visible();
}
```

## BEM Naming Convention

```less
// Block Element Modifier pattern
.card {
  // Block styles
  background: @color-background;
  border-radius: @border-radius-md;
  box-shadow: @shadow-md;
  overflow: hidden;

  // Element: child of block
  &__header {
    padding: @spacing-md;
    border-bottom: 1px solid @color-border;
  }

  &__title {
    margin: 0;
    font-size: @font-size-large;
    font-weight: @font-weight-bold;
  }

  &__image {
    width: 100%;
    height: auto;
    display: block;
  }

  &__body {
    padding: @spacing-md;
  }

  &__footer {
    padding: @spacing-md;
    border-top: 1px solid @color-border;
    background: lighten(@color-border, 5%);
  }

  // Modifier: variant of block
  &--featured {
    border: 2px solid @color-primary;
  }

  &--horizontal {
    display: flex;

    .card__image {
      width: 200px;
      flex-shrink: 0;
    }
  }

  &--compact {
    .card__header,
    .card__body,
    .card__footer {
      padding: @spacing-sm;
    }
  }
}
```

## Nesting Rules

### Keep Nesting Shallow
```less
// BAD: Too deep nesting
.nav {
  .nav-list {
    .nav-item {
      .nav-link {
        .nav-icon {
          // 5 levels - creates high specificity
        }
      }
    }
  }
}

// GOOD: Flat BEM structure with shallow nesting
.nav {
  display: flex;
  align-items: center;
}

.nav__list {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav__item {
  margin: 0 @spacing-sm;
}

.nav__link {
  color: @color-text;
  text-decoration: none;
  transition: color @transition-base;

  // Acceptable: state nesting
  &:hover,
  &:focus {
    color: @color-primary;
  }

  // Acceptable: modifier nesting
  &--active {
    color: @color-primary;
    font-weight: @font-weight-bold;
  }
}
```

### Acceptable Nesting Patterns
```less
.component {
  // Pseudo-elements
  &::before,
  &::after {
    content: '';
    position: absolute;
  }

  // State pseudo-classes
  &:hover,
  &:focus,
  &:active {
    // State styles
  }

  // BEM modifiers
  &--variant {
    // Modifier styles
  }

  // Media queries
  .respond-to(@breakpoint-md, {
    // Responsive styles
  });
}
```

## Functions

### Built-in Functions
```less
// Color functions
.element {
  // Lighten/darken
  background: lighten(@color-primary, 20%);
  border-color: darken(@color-primary, 10%);

  // Saturation
  color: saturate(@color-primary, 20%);

  // Mix colors
  background: mix(@color-primary, @color-secondary, 50%);

  // Fade (opacity)
  background: fade(@color-primary, 50%);

  // Color extraction
  @hue: hue(@color-primary);
  @saturation: saturation(@color-primary);
  @lightness: lightness(@color-primary);
}

// Math functions
.element {
  width: percentage(1/3);        // 33.33333%
  height: round(10.5px);         // 11px
  margin: ceil(4.2px);           // 5px
  padding: floor(4.8px);         // 4px
  font-size: abs(-10px);         // 10px
  z-index: min(5, 10, 3);        // 3
  z-index: max(5, 10, 3);        // 10
}

// String functions
@selector: e(".my-class");      // Escape
@path: %("url(%s)", "image.png"); // Format
```

### Custom Functions (Using Mixins)
```less
// Less doesn't have true functions, use mixins with output
.spacing(@multiplier) {
  @result: (@spacing-unit * @multiplier);
}

// Usage with variable scope
.element {
  .spacing(3);
  padding: @result; // 24px
}

// Alternative: use variables directly
.padding(@multiplier) {
  padding: (@spacing-unit * @multiplier);
}

.margin(@multiplier) {
  margin: (@spacing-unit * @multiplier);
}

.element {
  .padding(2);
  .margin(1);
}
```

## Loops

### Generating Classes
```less
// Generate column classes
.generate-columns(@n, @i: 1) when (@i =< @n) {
  .col-@{i} {
    width: percentage(@i / @n);
  }
  .generate-columns(@n, (@i + 1));
}

// Usage: generates .col-1 through .col-12
.generate-columns(12);

// Generate spacing utilities
.generate-spacing(@i: 0) when (@i =< 8) {
  .m-@{i} {
    margin: (@spacing-unit * @i);
  }
  .mt-@{i} {
    margin-top: (@spacing-unit * @i);
  }
  .mb-@{i} {
    margin-bottom: (@spacing-unit * @i);
  }
  .p-@{i} {
    padding: (@spacing-unit * @i);
  }
  .pt-@{i} {
    padding-top: (@spacing-unit * @i);
  }
  .pb-@{i} {
    padding-bottom: (@spacing-unit * @i);
  }
  .generate-spacing((@i + 1));
}

.generate-spacing();
```

### Loop Over Lists
```less
// Define color list
@color-names: primary, secondary, success, danger, warning, info;
@color-values: @color-primary, @color-secondary, @color-success, @color-error, @color-warning, @color-info;

// Generate color utilities
.generate-colors(@names, @values, @i: 1) when (@i =< length(@names)) {
  @name: extract(@names, @i);
  @value: extract(@values, @i);

  .text-@{name} {
    color: @value;
  }
  .bg-@{name} {
    background-color: @value;
  }
  .border-@{name} {
    border-color: @value;
  }

  .generate-colors(@names, @values, (@i + 1));
}

.generate-colors(@color-names, @color-values);
```

## Guards (Conditionals)

```less
// Mixin with guards
.button-size(@size) when (@size = small) {
  padding: @spacing-xs @spacing-sm;
  font-size: @font-size-small;
}

.button-size(@size) when (@size = medium) {
  padding: @spacing-sm @spacing-md;
  font-size: @font-size-base;
}

.button-size(@size) when (@size = large) {
  padding: @spacing-md @spacing-lg;
  font-size: @font-size-large;
}

// Usage
.btn-sm {
  .button-size(small);
}

.btn-md {
  .button-size(medium);
}

.btn-lg {
  .button-size(large);
}

// Guards with comparison operators
.set-color(@lightness) when (@lightness > 50%) {
  color: black;
}

.set-color(@lightness) when (@lightness =< 50%) {
  color: white;
}
```

## Namespacing

```less
// Group related mixins
#utils {
  .clearfix() {
    &::after {
      content: '';
      display: table;
      clear: both;
    }
  }

  .visually-hidden() {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }
}

#buttons {
  .base() {
    display: inline-flex;
    align-items: center;
    border: none;
    cursor: pointer;
    transition: all @transition-base;
  }

  .primary() {
    #buttons.base();
    background: @color-primary;
    color: white;
  }
}

// Usage
.container {
  #utils.clearfix();
}

.btn-primary {
  #buttons.primary();
}
```

## Performance Best Practices

- Avoid deeply nested selectors (max 3 levels)
- Keep specificity low - prefer single class selectors
- Never use `!important` except for utility overrides
- Use mixins for vendor prefixes (or autoprefixer)
- Minimize use of `extend` as it can increase file size
- Compile to compressed CSS in production
- Enable source maps in development only

## Code Style Guidelines

- Use 2 spaces for indentation
- Use single quotes for strings
- Add a space after colons in declarations
- Add a space before opening braces
- Put closing braces on new lines
- Separate rule sets with blank lines
- Comment complex logic
- Order properties consistently

## Property Order

```less
.element {
  // Positioning
  position: relative;
  top: 0;
  right: 0;
  z-index: @z-index-dropdown;

  // Display & Box Model
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: @container-md;
  padding: @spacing-md;
  margin: @spacing-sm auto;

  // Typography
  font-family: @font-family-base;
  font-size: @font-size-base;
  font-weight: @font-weight-normal;
  line-height: @line-height-base;
  color: @color-text;
  text-align: left;

  // Visual
  background-color: @color-background;
  border: 1px solid @color-border;
  border-radius: @border-radius-md;
  box-shadow: @shadow-sm;

  // Animation
  transition: all @transition-base;

  // Misc
  cursor: pointer;
  overflow: hidden;
}
```
