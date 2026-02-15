---
name: expo-react-native-javascript-best-practices
description: Expo React Native JavaScript best practices for clean code, functional components, performance optimization, and Expo Router navigation.
---

# Expo React Native JavaScript Best Practices

Guidelines for building high-quality Expo React Native applications with JavaScript, focusing on clean code, modularity, and performance.

## Code Style and Structure

- **Clean, Readable Code**: Ensure your code is easy to read and understand. Use descriptive names for variables and functions.
- **Functional Components**: Prefer functional components with hooks (useState, useEffect) over class components
- **Component Modularity**: Break components into smaller, reusable pieces with single responsibility
- **Feature-Based Organization**: Group related components, hooks, and styles into feature directories (e.g., user-profile, chat-screen)

## Naming Conventions

- **Variables and Functions**: Use camelCase (e.g., `isFetchingData`, `handleUserInput`)
- **Components**: Use PascalCase (e.g., `UserProfile`, `ChatScreen`)
- **Directories**: Use lowercase hyphenated names (e.g., `user-profile`, `chat-screen`)

## JavaScript Usage

- Minimize global variables to prevent unintended side effects
- Leverage ES6+ features like arrow functions, destructuring, and template literals to write concise code
- Use PropTypes for type checking if not using TypeScript

## Performance Optimization

- Avoid unnecessary state updates; use local state when needed
- Apply `React.memo()` to prevent unnecessary re-renders
- Optimize FlatList with the following props:
  - `removeClippedSubviews`
  - `maxToRenderPerBatch`
  - `windowSize`
- Avoid anonymous functions in `renderItem` or event handlers

## UI and Styling

- Use `StyleSheet.create()` for consistent styling or Styled Components for dynamic styles
- Ensure responsive design across screen sizes and orientations
- Use optimized image libraries like `react-native-fast-image`

## Best Practices

- Follow React Native's threading model for smooth UI performance
- Use Expo's EAS Build and OTA updates for deployment
- **Expo Router**: Use Expo Router for file-based routing in your React Native app. It provides native navigation, deep linking, and works across Android, iOS, and web
