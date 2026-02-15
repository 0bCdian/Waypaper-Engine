---
name: styled-components-best-practices
description: styled-components best practices for CSS-in-JS development in React applications
---

# styled-components Best Practices

You are an expert in styled-components, CSS-in-JS patterns, and React component styling.

## Key Principles

- Write component-scoped styles that avoid global CSS conflicts
- Leverage the full power of JavaScript for dynamic styling
- Keep styled components small, focused, and reusable
- Prioritize performance with proper memoization and SSR support

## Basic Setup

### Installation
```bash
npm install styled-components
npm install -D @types/styled-components  # For TypeScript
```

### Basic Usage
```tsx
import styled from 'styled-components';

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #2980b9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Usage
function App() {
  return <Button>Click me</Button>;
}
```

## Project Structure

### File Organization
```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.styles.ts    # Styled components
│   │   ├── Button.types.ts     # TypeScript types
│   │   └── index.ts            # Re-exports
│   ├── Card/
│   │   ├── Card.tsx
│   │   ├── Card.styles.ts
│   │   └── index.ts
│   └── index.ts
├── styles/
│   ├── theme.ts                # Theme definition
│   ├── GlobalStyles.ts         # Global styles
│   ├── mixins.ts               # Reusable style mixins
│   └── index.ts
└── App.tsx
```

### Component Style File
```tsx
// Button.styles.ts
import styled, { css } from 'styled-components';
import type { ButtonProps } from './Button.types';

export const StyledButton = styled.button<Pick<ButtonProps, 'variant' | 'size'>>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-family: inherit;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transition.base};

  ${({ size, theme }) => {
    switch (size) {
      case 'small':
        return css`
          padding: ${theme.spacing.xs} ${theme.spacing.sm};
          font-size: ${theme.fontSize.small};
        `;
      case 'large':
        return css`
          padding: ${theme.spacing.md} ${theme.spacing.lg};
          font-size: ${theme.fontSize.large};
        `;
      default:
        return css`
          padding: ${theme.spacing.sm} ${theme.spacing.md};
          font-size: ${theme.fontSize.base};
        `;
    }
  }}

  ${({ variant, theme }) => {
    switch (variant) {
      case 'secondary':
        return css`
          background-color: transparent;
          color: ${theme.colors.primary};
          border: 2px solid ${theme.colors.primary};

          &:hover:not(:disabled) {
            background-color: ${theme.colors.primary};
            color: white;
          }
        `;
      case 'danger':
        return css`
          background-color: ${theme.colors.error};
          color: white;

          &:hover:not(:disabled) {
            background-color: ${theme.colors.errorDark};
          }
        `;
      default:
        return css`
          background-color: ${theme.colors.primary};
          color: white;

          &:hover:not(:disabled) {
            background-color: ${theme.colors.primaryDark};
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const ButtonIcon = styled.span`
  display: inline-flex;
  margin-right: ${({ theme }) => theme.spacing.xs};
`;
```

## Theming

### Theme Definition
```tsx
// styles/theme.ts
export const theme = {
  colors: {
    primary: '#3498db',
    primaryLight: '#5dade2',
    primaryDark: '#2980b9',
    secondary: '#2ecc71',
    secondaryLight: '#58d68d',
    secondaryDark: '#27ae60',
    error: '#e74c3c',
    errorLight: '#ec7063',
    errorDark: '#c0392b',
    warning: '#f39c12',
    success: '#27ae60',
    info: '#17a2b8',
    text: '#333333',
    textMuted: '#666666',
    textLight: '#999999',
    background: '#ffffff',
    backgroundAlt: '#f8f9fa',
    border: '#e0e0e0',
    borderDark: '#cccccc',
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },

  fontSize: {
    xs: '0.75rem',
    small: '0.875rem',
    base: '1rem',
    large: '1.25rem',
    xl: '1.5rem',
    xxl: '2rem',
    xxxl: '2.5rem',
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  fontFamily: {
    base: "'Helvetica Neue', Arial, sans-serif",
    heading: "'Georgia', serif",
    mono: "'Consolas', monospace",
  },

  lineHeight: {
    tight: 1.2,
    base: 1.5,
    relaxed: 1.75,
  },

  borderRadius: {
    sm: '2px',
    md: '4px',
    lg: '8px',
    xl: '16px',
    pill: '50px',
    circle: '50%',
  },

  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
  },

  transition: {
    fast: '0.15s ease',
    base: '0.3s ease',
    slow: '0.5s ease',
  },

  breakpoints: {
    sm: '576px',
    md: '768px',
    lg: '992px',
    xl: '1200px',
    xxl: '1400px',
  },

  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
} as const;

export type Theme = typeof theme;
```

### TypeScript Theme Typing
```tsx
// styles/styled.d.ts
import 'styled-components';
import type { Theme } from './theme';

declare module 'styled-components' {
  export interface DefaultTheme extends Theme {}
}
```

### Theme Provider Setup
```tsx
// App.tsx
import { ThemeProvider } from 'styled-components';
import { theme } from './styles/theme';
import { GlobalStyles } from './styles/GlobalStyles';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      {/* App content */}
    </ThemeProvider>
  );
}
```

## Global Styles

```tsx
// styles/GlobalStyles.ts
import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html {
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: ${({ theme }) => theme.fontFamily.base};
    font-size: ${({ theme }) => theme.fontSize.base};
    line-height: ${({ theme }) => theme.lineHeight.base};
    color: ${({ theme }) => theme.colors.text};
    background-color: ${({ theme }) => theme.colors.background};
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${({ theme }) => theme.fontFamily.heading};
    font-weight: ${({ theme }) => theme.fontWeight.bold};
    line-height: ${({ theme }) => theme.lineHeight.tight};
    margin-top: 0;
    margin-bottom: ${({ theme }) => theme.spacing.md};
  }

  p {
    margin-top: 0;
    margin-bottom: ${({ theme }) => theme.spacing.md};
  }

  a {
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  button {
    font-family: inherit;
  }

  img {
    max-width: 100%;
    height: auto;
  }

  /* Focus styles for accessibility */
  :focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;
```

## Dynamic Styling

### Props-Based Styling
```tsx
import styled, { css } from 'styled-components';

interface CardProps {
  $elevated?: boolean;
  $variant?: 'default' | 'outlined' | 'filled';
}

const Card = styled.div<CardProps>`
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.md};
  transition: box-shadow ${({ theme }) => theme.transition.base};

  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'outlined':
        return css`
          background: transparent;
          border: 1px solid ${theme.colors.border};
        `;
      case 'filled':
        return css`
          background: ${theme.colors.backgroundAlt};
          border: none;
        `;
      default:
        return css`
          background: ${theme.colors.background};
          border: 1px solid ${theme.colors.border};
        `;
    }
  }}

  ${({ $elevated, theme }) =>
    $elevated &&
    css`
      box-shadow: ${theme.shadow.md};

      &:hover {
        box-shadow: ${theme.shadow.lg};
      }
    `}
`;

// Usage with transient props ($prefix)
<Card $elevated $variant="outlined">Content</Card>
```

### Using CSS Helper
```tsx
import styled, { css } from 'styled-components';

// Reusable style blocks
const flexCenter = css`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const truncate = css`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const visuallyHidden = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

const Container = styled.div`
  ${flexCenter}
  min-height: 100vh;
`;

const Title = styled.h1`
  ${truncate}
  max-width: 300px;
`;

const SrOnly = styled.span`
  ${visuallyHidden}
`;
```

## Extending Components

### Extending Styled Components
```tsx
const Button = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
`;

const PrimaryButton = styled(Button)`
  background: #3498db;
  color: white;

  &:hover {
    background: #2980b9;
  }
`;

const OutlinedButton = styled(Button)`
  background: transparent;
  color: #3498db;
  border: 2px solid #3498db;

  &:hover {
    background: #3498db;
    color: white;
  }
`;
```

### Extending Third-Party Components
```tsx
import { Link } from 'react-router-dom';

const StyledLink = styled(Link)`
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: none;
  font-weight: ${({ theme }) => theme.fontWeight.medium};

  &:hover {
    text-decoration: underline;
  }
`;
```

## Responsive Design

### Media Query Helpers
```tsx
// styles/mixins.ts
import { css } from 'styled-components';
import type { Theme } from './theme';

type Breakpoint = keyof Theme['breakpoints'];

export const media = {
  up: (breakpoint: Breakpoint) =>
    (styles: ReturnType<typeof css>) => css`
      @media (min-width: ${({ theme }) => theme.breakpoints[breakpoint]}) {
        ${styles}
      }
    `,

  down: (breakpoint: Breakpoint) =>
    (styles: ReturnType<typeof css>) => css`
      @media (max-width: calc(${({ theme }) => theme.breakpoints[breakpoint]} - 1px)) {
        ${styles}
      }
    `,
};

// Usage
const Container = styled.div`
  padding: ${({ theme }) => theme.spacing.sm};

  ${({ theme }) => css`
    @media (min-width: ${theme.breakpoints.md}) {
      padding: ${theme.spacing.md};
    }

    @media (min-width: ${theme.breakpoints.lg}) {
      padding: ${theme.spacing.lg};
    }
  `}
`;
```

### Responsive Component
```tsx
const Grid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  grid-template-columns: 1fr;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(4, 1fr);
  }
`;
```

## Animations

### Keyframes
```tsx
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

const FadeInDiv = styled.div`
  animation: ${fadeIn} 0.3s ease-out;
`;

const Spinner = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid ${({ theme }) => theme.colors.border};
  border-top-color: ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;

const PulsingDot = styled.span`
  animation: ${pulse} 2s ease-in-out infinite;
`;
```

### Transition Groups
```tsx
import styled from 'styled-components';

const Modal = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  opacity: ${({ $isOpen }) => ($isOpen ? 1 : 0)};
  visibility: ${({ $isOpen }) => ($isOpen ? 'visible' : 'hidden')};
  transition: opacity 0.3s ease, visibility 0.3s ease;
`;

const ModalContent = styled.div<{ $isOpen: boolean }>`
  background: white;
  padding: ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  transform: ${({ $isOpen }) => ($isOpen ? 'scale(1)' : 'scale(0.95)')};
  transition: transform 0.3s ease;
`;
```

## Performance Optimization

### Avoid Interpolation in Static Styles
```tsx
// BAD: Creates new class on every render
const BadButton = styled.button`
  padding: ${8}px ${16}px;
  background: ${'#3498db'};
`;

// GOOD: Static values don't need interpolation
const GoodButton = styled.button`
  padding: 8px 16px;
  background: #3498db;
`;

// GOOD: Theme values are cached
const ThemedButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.primary};
`;
```

### Use Transient Props
```tsx
// Use $ prefix for props that shouldn't be passed to DOM
interface StyledProps {
  $isActive: boolean;
  $size: 'small' | 'medium' | 'large';
}

const StyledDiv = styled.div<StyledProps>`
  opacity: ${({ $isActive }) => ($isActive ? 1 : 0.5)};
  padding: ${({ $size, theme }) =>
    $size === 'small' ? theme.spacing.sm : theme.spacing.md};
`;

// Props with $ prefix won't appear in DOM
<StyledDiv $isActive={true} $size="medium" />
```

### Memoize Complex Components
```tsx
import { memo } from 'react';
import styled from 'styled-components';

const StyledCard = styled.div`
  /* styles */
`;

interface CardProps {
  title: string;
  description: string;
}

const Card = memo(({ title, description }: CardProps) => (
  <StyledCard>
    <h2>{title}</h2>
    <p>{description}</p>
  </StyledCard>
));
```

### SSR Configuration
```tsx
// For Next.js - next.config.js
module.exports = {
  compiler: {
    styledComponents: true,
  },
};

// For other frameworks - use ServerStyleSheet
import { ServerStyleSheet, StyleSheetManager } from 'styled-components';

const sheet = new ServerStyleSheet();

try {
  const html = renderToString(
    <StyleSheetManager sheet={sheet.instance}>
      <App />
    </StyleSheetManager>
  );
  const styleTags = sheet.getStyleTags();
} finally {
  sheet.seal();
}
```

## Best Practices

### Naming Conventions
```tsx
// Prefix styled components for clarity
export const StyledButton = styled.button``;
export const StyledCard = styled.div``;

// Or use descriptive names
export const ButtonWrapper = styled.div``;
export const CardContainer = styled.article``;
export const NavigationList = styled.ul``;
```

### Composition Over Inheritance
```tsx
// Prefer composition
const BaseText = styled.p`
  font-family: ${({ theme }) => theme.fontFamily.base};
  line-height: ${({ theme }) => theme.lineHeight.base};
`;

const Heading = styled(BaseText).attrs({ as: 'h1' })`
  font-size: ${({ theme }) => theme.fontSize.xxl};
  font-weight: ${({ theme }) => theme.fontWeight.bold};
`;

const Caption = styled(BaseText)`
  font-size: ${({ theme }) => theme.fontSize.small};
  color: ${({ theme }) => theme.colors.textMuted};
`;
```

### Use attrs for Static Props
```tsx
const Input = styled.input.attrs(props => ({
  type: props.type || 'text',
  placeholder: props.placeholder || 'Enter text...',
}))`
  padding: ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    outline: none;
  }
`;
```

### Accessibility
```tsx
const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;  /* Minimum touch target */
  height: 44px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

// Usage
<IconButton aria-label="Close menu">
  <CloseIcon />
  <VisuallyHidden>Close menu</VisuallyHidden>
</IconButton>
```

## Testing

### Testing Styled Components
```tsx
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { theme } from './styles/theme';
import { Button } from './components/Button';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('Button', () => {
  it('renders with correct styles', () => {
    renderWithTheme(<Button variant="primary">Click me</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveStyle({
      backgroundColor: theme.colors.primary,
    });
  });
});
```

## Code Style

- One styled component per declaration
- Order: component declaration, styled components, types
- Use template literal syntax for multi-line styles
- Use css helper for reusable style blocks
- Prefix transient props with $
- Keep styled components close to their usage
- Extract shared styles into mixins or theme
