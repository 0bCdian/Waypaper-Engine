---
name: sass-best-practices
description: Sass (indented syntax) best practices and coding guidelines for clean, maintainable stylesheets
---

# Sass Best Practices

You are an expert in Sass (the indented syntax), CSS architecture, and maintainable stylesheet development.

## Key Principles

- Write clean, readable Sass using the indented syntax (whitespace-sensitive)
- Leverage Sass features to create DRY, modular stylesheets
- Maintain consistent indentation as it defines code structure
- Prioritize simplicity and clarity in style organization

## Sass vs SCSS

Sass uses the original indented syntax:
- No curly braces `{}`
- No semicolons `;`
- Indentation defines nesting
- File extension: `.sass`

```sass
// Sass (indented syntax)
.button
  display: inline-flex
  padding: 8px 16px
  background: #3498db

  &:hover
    background: darken(#3498db, 10%)
```

```scss
// SCSS syntax (for comparison)
.button {
  display: inline-flex;
  padding: 8px 16px;
  background: #3498db;

  &:hover {
    background: darken(#3498db, 10%);
  }
}
```

## File Organization

### Project Structure
```
sass/
├── abstracts/
│   ├── _variables.sass
│   ├── _functions.sass
│   ├── _mixins.sass
│   └── _placeholders.sass
├── base/
│   ├── _reset.sass
│   ├── _typography.sass
│   └── _base.sass
├── components/
│   ├── _buttons.sass
│   ├── _cards.sass
│   └── _forms.sass
├── layout/
│   ├── _header.sass
│   ├── _footer.sass
│   └── _grid.sass
├── pages/
│   └── _home.sass
├── themes/
│   └── _default.sass
├── vendors/
│   └── _normalize.sass
└── main.sass
```

### Main Manifest
```sass
// main.sass
@use 'abstracts/variables'
@use 'abstracts/functions'
@use 'abstracts/mixins'
@use 'abstracts/placeholders'

@use 'vendors/normalize'

@use 'base/reset'
@use 'base/typography'
@use 'base/base'

@use 'layout/grid'
@use 'layout/header'
@use 'layout/footer'

@use 'components/buttons'
@use 'components/cards'
@use 'components/forms'

@use 'pages/home'

@use 'themes/default'
```

## Variables

### Naming and Organization
```sass
// _variables.sass

// Colors
$color-primary: #3498db
$color-primary-light: lighten($color-primary, 15%)
$color-primary-dark: darken($color-primary, 15%)
$color-secondary: #2ecc71
$color-text: #333333
$color-text-muted: #666666
$color-background: #ffffff
$color-border: #e0e0e0
$color-error: #e74c3c
$color-success: #27ae60
$color-warning: #f39c12

// Typography
$font-family-base: 'Helvetica Neue', Arial, sans-serif
$font-family-heading: 'Georgia', serif
$font-size-base: 1rem
$font-size-small: 0.875rem
$font-size-large: 1.25rem
$font-weight-normal: 400
$font-weight-bold: 700
$line-height-base: 1.5

// Spacing Scale
$spacing-unit: 8px
$spacing-xs: $spacing-unit * 0.5
$spacing-sm: $spacing-unit
$spacing-md: $spacing-unit * 2
$spacing-lg: $spacing-unit * 3
$spacing-xl: $spacing-unit * 4
$spacing-xxl: $spacing-unit * 6

// Breakpoints
$breakpoint-sm: 576px
$breakpoint-md: 768px
$breakpoint-lg: 992px
$breakpoint-xl: 1200px

// Z-index Scale
$z-index-dropdown: 1000
$z-index-sticky: 1020
$z-index-fixed: 1030
$z-index-modal: 1050
$z-index-tooltip: 1070

// Transitions
$transition-base: 0.3s ease
$transition-fast: 0.15s ease
$transition-slow: 0.5s ease

// Border Radius
$border-radius-sm: 2px
$border-radius-md: 4px
$border-radius-lg: 8px
$border-radius-pill: 50px

// Shadows
$shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05)
$shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1)
$shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1)
```

### Using Maps
```sass
// Define maps for grouped values
$colors: ("primary": #3498db, "secondary": #2ecc71, "danger": #e74c3c, "warning": #f39c12, "success": #27ae60)

$breakpoints: ("sm": 576px, "md": 768px, "lg": 992px, "xl": 1200px)

// Access values
.element
  color: map-get($colors, "primary")
```

## Mixins

### Responsive Design
```sass
// _mixins.sass

=respond-to($breakpoint)
  @if map-has-key($breakpoints, $breakpoint)
    @media (min-width: map-get($breakpoints, $breakpoint))
      @content
  @else
    @warn "Unknown breakpoint: #{$breakpoint}"

// Usage
.element
  width: 100%

  +respond-to("md")
    width: 50%

  +respond-to("lg")
    width: 33.333%
```

### Flexbox Utilities
```sass
=flex-center
  display: flex
  align-items: center
  justify-content: center

=flex-between
  display: flex
  align-items: center
  justify-content: space-between

=flex-column
  display: flex
  flex-direction: column

// Usage
.container
  +flex-center
  min-height: 100vh
```

### Typography
```sass
=font-size($size, $line-height: null)
  font-size: $size
  @if $line-height
    line-height: $line-height

=truncate($lines: 1)
  @if $lines == 1
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
  @else
    display: -webkit-box
    -webkit-line-clamp: $lines
    -webkit-box-orient: vertical
    overflow: hidden

// Usage
.title
  +font-size(2rem, 1.2)

.description
  +truncate(3)
```

### Accessibility
```sass
=visually-hidden
  position: absolute
  width: 1px
  height: 1px
  padding: 0
  margin: -1px
  overflow: hidden
  clip: rect(0, 0, 0, 0)
  white-space: nowrap
  border: 0

=focus-visible
  &:focus-visible
    outline: 2px solid $color-primary
    outline-offset: 2px

// Usage
.sr-only
  +visually-hidden

.interactive
  +focus-visible
```

### Button Styles
```sass
=button-base
  display: inline-flex
  align-items: center
  justify-content: center
  padding: $spacing-sm $spacing-md
  border: none
  border-radius: $border-radius-md
  font-family: inherit
  font-size: $font-size-base
  font-weight: $font-weight-bold
  text-decoration: none
  cursor: pointer
  transition: all $transition-base

  &:disabled
    opacity: 0.5
    cursor: not-allowed

=button-variant($bg-color, $text-color: white)
  +button-base
  background: $bg-color
  color: $text-color

  &:hover:not(:disabled)
    background: darken($bg-color, 10%)

  &:active:not(:disabled)
    background: darken($bg-color, 15%)

// Usage
.btn-primary
  +button-variant($color-primary)

.btn-secondary
  +button-variant($color-secondary)

.btn-danger
  +button-variant($color-error)
```

## BEM Naming Convention

```sass
// Block
.card
  background: $color-background
  border-radius: $border-radius-md
  box-shadow: $shadow-md

  // Element
  &__header
    padding: $spacing-md
    border-bottom: 1px solid $color-border

  &__title
    margin: 0
    font-size: $font-size-large
    font-weight: $font-weight-bold

  &__body
    padding: $spacing-md

  &__footer
    padding: $spacing-md
    border-top: 1px solid $color-border

  // Modifier
  &--featured
    border: 2px solid $color-primary

  &--compact
    .card__header,
    .card__body,
    .card__footer
      padding: $spacing-sm
```

## Nesting Guidelines

### Keep Nesting Shallow
```sass
// BAD: Too deep
.nav
  .nav-list
    .nav-item
      .nav-link
        .nav-icon
          // 5 levels - avoid this

// GOOD: Flat BEM structure
.nav
  display: flex

.nav__list
  display: flex
  list-style: none
  margin: 0
  padding: 0

.nav__item
  margin: 0 $spacing-sm

.nav__link
  color: $color-text
  text-decoration: none

  &:hover,
  &:focus
    color: $color-primary

  &--active
    color: $color-primary
    font-weight: $font-weight-bold
```

### Acceptable Nesting
```sass
.component
  // Pseudo-elements
  &::before,
  &::after
    content: ''

  // States
  &:hover,
  &:focus,
  &:active
    // State styles

  // Modifiers
  &--variant
    // Modifier styles

  // Media queries
  +respond-to("md")
    // Responsive styles
```

## Functions

```sass
// _functions.sass

// Color functions
@function tint($color, $percentage)
  @return mix(white, $color, $percentage)

@function shade($color, $percentage)
  @return mix(black, $color, $percentage)

// Unit conversion
@function px-to-rem($px, $base: 16)
  @return ($px / $base) * 1rem

@function rem-to-px($rem, $base: 16)
  @return ($rem / 1rem) * $base * 1px

// Spacing helper
@function spacing($multiplier)
  @return $spacing-unit * $multiplier

// Usage
.element
  background: tint($color-primary, 20%)
  border-color: shade($color-primary, 10%)
  font-size: px-to-rem(18)
  padding: spacing(3)
```

## Placeholders and Extend

```sass
// Define placeholders
%clearfix
  &::after
    content: ''
    display: table
    clear: both

%list-reset
  list-style: none
  margin: 0
  padding: 0

%button-reset
  appearance: none
  background: none
  border: none
  padding: 0
  font: inherit
  cursor: pointer

// Usage
.container
  @extend %clearfix

.nav-list
  @extend %list-reset

.icon-button
  @extend %button-reset
```

## Loops and Iteration

### Generate Utility Classes
```sass
// Spacing utilities
$directions: ("": "", "t": "-top", "r": "-right", "b": "-bottom", "l": "-left")

@each $abbr, $dir in $directions
  @for $i from 0 through 8
    .m#{$abbr}-#{$i}
      margin#{$dir}: spacing($i)
    .p#{$abbr}-#{$i}
      padding#{$dir}: spacing($i)

// Color utilities
@each $name, $color in $colors
  .text-#{$name}
    color: $color
  .bg-#{$name}
    background-color: $color
```

### Grid Generation
```sass
$grid-columns: 12

@for $i from 1 through $grid-columns
  .col-#{$i}
    width: percentage($i / $grid-columns)

// Responsive columns
@each $bp, $width in $breakpoints
  @media (min-width: $width)
    @for $i from 1 through $grid-columns
      .col-#{$bp}-#{$i}
        width: percentage($i / $grid-columns)
```

## Conditionals

```sass
=theme-button($variant)
  @if $variant == "primary"
    background: $color-primary
    color: white
  @else if $variant == "secondary"
    background: transparent
    color: $color-primary
    border: 2px solid $color-primary
  @else if $variant == "danger"
    background: $color-error
    color: white
  @else
    background: $color-text-muted
    color: white

.btn-primary
  +theme-button("primary")

.btn-secondary
  +theme-button("secondary")
```

## Modern Module System

### Using @use and @forward
```sass
// _variables.sass
$primary: #3498db

// _mixins.sass
@use 'variables' as vars

=themed-element
  color: vars.$primary

// _index.sass (barrel file)
@forward 'variables'
@forward 'mixins'

// main.sass
@use 'abstracts'

.element
  +abstracts.themed-element
```

## Performance Tips

- Keep selector specificity low (prefer single class selectors)
- Avoid `!important` except for utility overrides
- Use `@use` instead of deprecated `@import`
- Limit `@extend` usage across files
- Compile without source maps in production
- Let autoprefixer handle vendor prefixes

## Code Style Guidelines

- Use 2 spaces for indentation (critical in Sass)
- Use single quotes for strings
- One blank line between rule sets
- Group related properties together
- Comment non-obvious code
- Use meaningful variable names
- Keep lines under 80 characters when possible

## Property Order

```sass
.element
  // Positioning
  position: relative
  top: 0
  right: 0
  z-index: 10

  // Display & Box Model
  display: flex
  width: 100%
  padding: $spacing-md
  margin: $spacing-sm 0

  // Typography
  font-family: $font-family-base
  font-size: $font-size-base
  line-height: $line-height-base
  color: $color-text

  // Visual
  background: $color-background
  border: 1px solid $color-border
  border-radius: $border-radius-md
  box-shadow: $shadow-sm

  // Animation
  transition: all $transition-base

  // Misc
  cursor: pointer
```
