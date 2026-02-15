---
name: motion
description: Expert guidelines for building performant animations with Motion (formerly Motion One) vanilla JavaScript animation library
---

# Motion Animation Guidelines

You are an expert in Motion (motion.dev), JavaScript, TypeScript, and web animation performance. Follow these guidelines when creating animations.

## Core Principles

### About Motion
- Motion is the JavaScript animation library from the creator of Framer Motion
- Use `motion` for vanilla JavaScript/TypeScript projects
- Use `motion/react` for React projects (see framer-motion skill)
- Designed for high performance with minimal bundle size

### Installation
```bash
npm install motion
```

### Basic Import
```javascript
import { animate, scroll, inView, timeline } from "motion";
```

## Basic Animations

### Simple Animation
```javascript
import { animate } from "motion";

// Animate a single element
animate(".element", { x: 100, opacity: 1 }, { duration: 0.5 });

// Animate with options
animate(
  ".element",
  { transform: "translateX(100px)" },
  {
    duration: 0.8,
    easing: "ease-out"
  }
);
```

### Keyframes
```javascript
animate(
  ".element",
  {
    x: [0, 100, 50],      // Keyframe values
    opacity: [0, 1, 0.5]
  },
  { duration: 1 }
);
```

## Performance Optimization

### Animate Transform Properties
```javascript
// Best performance - GPU accelerated
animate(".element", {
  x: 100,           // translateX
  y: 50,            // translateY
  scale: 1.2,       // scale
  rotate: 45,       // rotate
  opacity: 0.5      // opacity
});

// Avoid when possible - triggers layout
animate(".element", {
  width: 200,       // Causes layout recalculation
  height: 150,      // Causes layout recalculation
  top: 50,          // Causes layout recalculation
  left: 100         // Causes layout recalculation
});
```

### Use will-change
```javascript
// Add will-change for transform animations
const element = document.querySelector(".element");
element.style.willChange = "transform";

animate(element, { x: 100 }, {
  onComplete: () => {
    element.style.willChange = "auto"; // Remove after animation
  }
});
```

### Hardware Acceleration
Motion automatically uses hardware-accelerated properties when possible. For best performance:

1. Prefer `x`, `y` over `left`, `top`
2. Prefer `scale` over `width`, `height`
3. Use `opacity` for fade effects
4. Use `rotate` over `transform: rotate()`

## Timeline Animations

### Create Timelines
```javascript
import { timeline } from "motion";

const sequence = [
  [".header", { y: ["-100%", 0], opacity: [0, 1] }],
  [".content", { y: [50, 0], opacity: [0, 1] }, { at: "-0.3" }],
  [".footer", { y: [50, 0], opacity: [0, 1] }, { at: "-0.3" }]
];

const controls = timeline(sequence, {
  duration: 0.8,
  defaultOptions: { easing: "ease-out" }
});
```

### Timeline Controls
```javascript
const controls = timeline(sequence);

controls.play();
controls.pause();
controls.reverse();
controls.stop();
controls.finish();

// Seek to specific time
controls.currentTime = 0.5;
```

## Scroll Animations

### Basic Scroll Animation
```javascript
import { scroll, animate } from "motion";

scroll(
  animate(".progress-bar", { scaleX: [0, 1] }),
  { target: document.querySelector("article") }
);
```

### Scroll-Linked Animation
```javascript
scroll(({ y }) => {
  // y.progress is 0 to 1
  animate(".element", {
    opacity: y.progress,
    y: y.progress * 100
  }, { duration: 0 });
});
```

### Scroll with Container
```javascript
scroll(
  animate(".parallax", { y: [0, -100] }),
  {
    target: document.querySelector(".section"),
    offset: ["start end", "end start"]
  }
);
```

## In-View Animations

### Trigger on Visibility
```javascript
import { inView, animate } from "motion";

inView(".card", (info) => {
  animate(info.target, { opacity: 1, y: 0 }, { duration: 0.5 });

  // Return cleanup function
  return () => {
    animate(info.target, { opacity: 0, y: 20 }, { duration: 0.2 });
  };
});
```

### With Options
```javascript
inView(
  ".element",
  (info) => {
    animate(info.target, { scale: [0.8, 1], opacity: [0, 1] });
  },
  {
    margin: "-100px",  // Trigger 100px before entering viewport
    amount: 0.5        // Trigger when 50% visible
  }
);
```

## Stagger Animations

### Stagger Multiple Elements
```javascript
import { stagger, animate } from "motion";

animate(
  ".list-item",
  { opacity: [0, 1], y: [20, 0] },
  { delay: stagger(0.1) }
);
```

### Stagger from Center
```javascript
animate(
  ".grid-item",
  { scale: [0, 1] },
  { delay: stagger(0.05, { from: "center" }) }
);
```

### Stagger with Easing
```javascript
animate(
  ".item",
  { x: ["-100%", 0] },
  {
    delay: stagger(0.1, {
      easing: "ease-out",
      start: 0.2
    })
  }
);
```

## Spring Animations

### Use Springs for Natural Motion
```javascript
animate(
  ".element",
  { scale: 1.2 },
  {
    easing: "spring",
    // or with custom spring settings
    easing: [0.34, 1.56, 0.64, 1] // Custom bezier curve
  }
);
```

### Spring Options
```javascript
animate(".element", { x: 100 }, {
  type: "spring",
  stiffness: 300,
  damping: 30
});
```

## Easing Functions

### Built-in Easings
```javascript
// Common easing values
animate(".element", { x: 100 }, { easing: "ease" });
animate(".element", { x: 100 }, { easing: "ease-in" });
animate(".element", { x: 100 }, { easing: "ease-out" });
animate(".element", { x: 100 }, { easing: "ease-in-out" });
animate(".element", { x: 100 }, { easing: "linear" });

// Cubic bezier
animate(".element", { x: 100 }, {
  easing: [0.25, 0.1, 0.25, 1]
});
```

## Animation Controls

### Control Playback
```javascript
const controls = animate(".element", { x: 100 }, { duration: 1 });

// Control methods
controls.play();
controls.pause();
controls.stop();
controls.finish();
controls.reverse();

// Get/set time
controls.currentTime = 0.5;
console.log(controls.duration);

// Cancel animation
controls.cancel();
```

### Animation Events
```javascript
const controls = animate(
  ".element",
  { x: 100 },
  {
    duration: 1,
    onComplete: () => console.log("Done!")
  }
);

// Promise-based
controls.finished.then(() => {
  console.log("Animation finished");
});
```

## Accessibility

### Respect Reduced Motion
```javascript
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

animate(
  ".element",
  { x: 100, opacity: 1 },
  {
    duration: prefersReducedMotion ? 0 : 0.5,
    easing: prefersReducedMotion ? "linear" : "ease-out"
  }
);
```

### Create Accessible Wrapper
```javascript
function safeAnimate(element, keyframes, options = {}) {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  return animate(element, keyframes, {
    ...options,
    duration: reducedMotion ? 0 : (options.duration ?? 0.3)
  });
}
```

## Integration with Frameworks

### Vanilla JavaScript
```javascript
document.addEventListener("DOMContentLoaded", () => {
  animate(".hero", { opacity: [0, 1], y: [30, 0] });
});
```

### With Event Listeners
```javascript
const button = document.querySelector(".button");

button.addEventListener("mouseenter", () => {
  animate(button, { scale: 1.05 }, { duration: 0.2 });
});

button.addEventListener("mouseleave", () => {
  animate(button, { scale: 1 }, { duration: 0.2 });
});
```

## Cleanup

### Cancel Animations
```javascript
const controls = animate(".element", { x: 100 });

// Later, cancel it
controls.cancel();
```

### Cleanup Pattern
```javascript
class AnimatedComponent {
  constructor(element) {
    this.element = element;
    this.animations = [];
  }

  animate(keyframes, options) {
    const controls = animate(this.element, keyframes, options);
    this.animations.push(controls);
    return controls;
  }

  destroy() {
    this.animations.forEach(anim => anim.cancel());
    this.animations = [];
  }
}
```

## Best Practices Summary

1. Use transform properties (x, y, scale, rotate) for best performance
2. Add will-change before complex animations, remove after
3. Use timeline for sequenced animations
4. Use scroll() for scroll-linked effects
5. Use inView() for viewport-triggered animations
6. Use stagger() for animating multiple elements
7. Prefer springs for interactive/gesture animations
8. Always respect reduced motion preferences
9. Cancel animations when no longer needed
10. Test performance on actual devices
