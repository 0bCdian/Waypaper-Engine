---
name: storybook
description: Best practices for building and documenting component libraries with Storybook
---

# Storybook Best Practices

You are an expert in building and documenting component libraries with Storybook. Apply these guidelines when creating stories, organizing components, and maintaining design systems.

## Project Structure

### Directory Organization

- Place stories alongside component files (Component.stories.tsx)
- Use consistent naming conventions for story files
- Organize stories by feature or component type
- Maintain a clear hierarchy matching your component library

### File Naming

- Use PascalCase for component story files
- Follow pattern: `ComponentName.stories.tsx`
- Group related stories in the same file
- Use descriptive story names that explain the variant

## Writing Stories

### Story Structure

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { Component } from './Component';

const meta: Meta<typeof Component> = {
  title: 'Category/Component',
  component: Component,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    // Define arg types here
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // Default props
  },
};

export const Variant: Story = {
  args: {
    variant: 'secondary',
  },
};
```

### Story Best Practices

- Create a Default story showing primary usage
- Add stories for each significant variant
- Include edge cases and error states
- Document interactive states (hover, focus, disabled)
- Show responsive behavior when relevant

## Component Documentation

### Autodocs

- Enable autodocs for automatic documentation generation
- Write clear JSDoc comments for components and props
- Document prop types, defaults, and requirements
- Include usage examples in component comments

### Custom Documentation

- Add MDX files for complex documentation needs
- Include design rationale and usage guidelines
- Document accessibility considerations
- Provide code examples for common use cases

## Args and Controls

### ArgTypes Configuration

```typescript
argTypes: {
  variant: {
    control: 'select',
    options: ['primary', 'secondary', 'tertiary'],
    description: 'Visual style variant',
    table: {
      defaultValue: { summary: 'primary' },
    },
  },
  size: {
    control: 'radio',
    options: ['sm', 'md', 'lg'],
  },
  disabled: {
    control: 'boolean',
  },
  onClick: {
    action: 'clicked',
  },
}
```

### Args Best Practices

- Use meaningful default values
- Group related args logically
- Provide descriptions for complex props
- Set up actions for callback props

## Decorators and Parameters

### Decorators

```typescript
decorators: [
  (Story) => (
    <ThemeProvider theme={defaultTheme}>
      <Story />
    </ThemeProvider>
  ),
],
```

- Use decorators for consistent story wrappers
- Apply theme providers at the appropriate level
- Add layout containers when needed
- Keep decorators simple and reusable

### Parameters

```typescript
parameters: {
  layout: 'centered', // or 'fullscreen', 'padded'
  backgrounds: {
    default: 'light',
    values: [
      { name: 'light', value: '#ffffff' },
      { name: 'dark', value: '#1a1a1a' },
    ],
  },
  viewport: {
    defaultViewport: 'responsive',
  },
},
```

## Testing with Storybook

### Interaction Testing

```typescript
import { within, userEvent } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

export const Clickable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');

    await userEvent.click(button);
    await expect(button).toHaveFocus();
  },
};
```

### Visual Testing

- Configure visual regression testing
- Capture stories at multiple viewports
- Test theme variations (light/dark mode)
- Document visual test coverage

### Accessibility Testing

- Enable a11y addon for accessibility checks
- Address all accessibility violations
- Test keyboard navigation in stories
- Document ARIA requirements

## Addons and Configuration

### Essential Addons

- @storybook/addon-essentials (docs, controls, actions, viewport)
- @storybook/addon-a11y for accessibility testing
- @storybook/addon-interactions for interaction testing
- @storybook/addon-designs for design spec integration

### Configuration

```typescript
// .storybook/main.ts
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
```

## Design System Integration

### Design Tokens

- Import design tokens from your token system
- Apply tokens consistently in stories
- Document token usage in component docs
- Show token variations in dedicated stories

### Theme Support

- Configure theme provider in preview.js
- Create stories for each theme variant
- Test components across all supported themes
- Document theme-specific behavior

## Performance

### Build Optimization

- Use lazy loading for large story collections
- Optimize static assets
- Configure proper caching
- Monitor and improve build times

### Story Performance

- Avoid heavy computations in stories
- Use mock data efficiently
- Lazy load complex dependencies
- Profile and optimize slow stories

## Best Practices Summary

- Write stories that serve as living documentation
- Test components in isolation before integration
- Keep stories simple and focused
- Maintain consistency across all stories
- Update stories when components change
- Use stories for design review and QA
- Make accessibility testing part of the workflow
- Integrate with your CI/CD pipeline
