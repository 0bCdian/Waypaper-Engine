---
name: framer-motion
description: Expert guidelines for building performant animations with Framer Motion/Motion library in React applications
---

# Framer Motion / Motion Animation Guidelines

You are an expert in Framer Motion (now Motion), React, and TypeScript. Follow these guidelines when creating animations.

## Core Principles

### Import from the Correct Package
- Use `import { motion } from "motion/react"` for React projects (not "framer-motion" - this is outdated)
- The library was renamed from Framer Motion to Motion
- Always use the latest Motion API

### Performance-First Approach
- Animate transform properties (`x`, `y`, `scale`, `rotate`) and `opacity` for best performance
- These properties can be hardware-accelerated and don't trigger layout recalculations
- Avoid animating properties that cause layout shifts like `width`, `height`, `top`, `left`, `margin`, `padding`

## Hardware Acceleration

### Use will-change Properly
```tsx
// When animating transforms
<motion.div
  style={{ willChange: "transform" }}
  animate={{ x: 100, y: 50, scale: 1.2 }}
/>

// When animating other GPU-accelerated properties
<motion.div
  style={{ willChange: "opacity, transform" }}
  animate={{ opacity: 0.5, x: 100 }}
/>
```

### Properties to Add to willChange
- `transform` - for x, y, scale, rotate, skew
- `opacity` - for opacity animations
- `filter` - for blur, brightness, etc.
- `clipPath` - for clip-path animations
- `backgroundColor` - for background color transitions

## Animation Best Practices

### Use Variants for Complex Animations
```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};
```

### Use layoutId for Shared Element Transitions
```tsx
<motion.div layoutId="shared-element" />
```

### Prefer spring Animations
```tsx
// Springs feel more natural than duration-based animations
<motion.div
  animate={{ x: 100 }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
/>
```

## React Integration

### Memoization for Performance
```tsx
// Memoize animation variants
const variants = useMemo(() => ({
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
}), []);

// Memoize callbacks
const handleAnimationComplete = useCallback(() => {
  // handler logic
}, []);
```

### Avoid Inline Style Objects
```tsx
// Bad - creates new object on every render
<motion.div style={{ willChange: "transform" }} />

// Good - define outside or memoize
const style = { willChange: "transform" };
<motion.div style={style} />
```

## Accessibility

### Respect Reduced Motion Preferences
```tsx
import { useReducedMotion } from "motion/react";

function Component() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={{ x: shouldReduceMotion ? 0 : 100 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
    />
  );
}
```

## Gesture Animations

### Use Gesture Props Correctly
```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
/>
```

## Scroll Animations

### Use useScroll for Scroll-Linked Animations
```tsx
import { useScroll, useTransform, motion } from "motion/react";

function ParallaxComponent() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return <motion.div style={{ y }} />;
}
```

## Exit Animations

### Use AnimatePresence for Exit Animations
```tsx
import { AnimatePresence, motion } from "motion/react";

<AnimatePresence mode="wait">
  {isVisible && (
    <motion.div
      key="modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  )}
</AnimatePresence>
```

## Common Patterns

### Staggered List Animation
```tsx
<motion.ul
  initial="hidden"
  animate="visible"
  variants={{
    visible: { transition: { staggerChildren: 0.07 } }
  }}
>
  {items.map((item) => (
    <motion.li
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    />
  ))}
</motion.ul>
```

### Page Transitions
```tsx
const pageTransition = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
  transition: { duration: 0.3 }
};
```

## Performance Debugging

- Use React DevTools to inspect re-renders
- Use Chrome DevTools Performance tab to identify animation jank
- Target 60fps minimum, 120fps on high refresh rate displays
- Test on actual devices, especially mid-range Android phones
