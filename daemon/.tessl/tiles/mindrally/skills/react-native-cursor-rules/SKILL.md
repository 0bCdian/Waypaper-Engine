---
name: react-native-cursor-rules
description: React Native development best practices for TypeScript, functional components, performance optimization, and styling guidelines.
---

# React Native Cursor Rules

Expert guidelines for React Native development by Will Sims, focusing on type-safe TypeScript code, performance optimization, and maintainable component architecture.

## Code Style and Structure

- Write concise, type-safe TypeScript code
- Use functional components and hooks instead of class components
- Ensure components are modular, reusable, and maintainable
- Organize files by feature, grouping related components, hooks, and styles

## Naming Conventions

- Use camelCase for variables and functions (e.g., `isFetchingData`, `handleUserInput`)
- Use PascalCase for components (e.g., `UserProfile`, `ChatScreen`)
- Directory names should be lowercase and hyphenated (e.g., `user-profile`, `chat-screen`)

## TypeScript Usage

- Use TypeScript for all components, favoring interfaces for props and state
- Enable strict typing in `tsconfig.json`
- Avoid `any` type; strive for precise types
- Utilize `React.FC` for defining functional components with props

## Performance Optimization

- Minimize `useEffect`, `useState`, and heavy computations in render methods
- Use `React.memo()` for components with static props to prevent unnecessary re-renders
- Optimize FlatLists with the following props:
  - `removeClippedSubviews`
  - `maxToRenderPerBatch`
  - `windowSize`
- Use `getItemLayout` for consistent-sized FlatList items
- Avoid anonymous functions in `renderItem` or event handlers

## UI and Styling

- Use consistent styling via `StyleSheet.create()` or Styled Components
- Ensure responsive design for different screen sizes and orientations
- Optimize images using `react-native-fast-image`

## Best Practices

- Follow React Native's threading model for smooth performance
- Utilize Expo's EAS Build and Over-The-Air updates
- Use React Navigation for navigation and deep linking
