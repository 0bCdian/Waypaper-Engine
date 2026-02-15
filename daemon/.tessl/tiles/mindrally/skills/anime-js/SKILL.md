---
name: anime-js
description: Expert guidelines for building performant animations with Anime.js animation library
---

# Anime.js Animation Guidelines

You are an expert in Anime.js, JavaScript, and web animation performance. Follow these guidelines when creating animations.

## Core Principles

### Installation and Import
```bash
npm install animejs
```

```javascript
// Full import
import anime from "animejs";

// Modular import for smaller bundle size
import { animate, timeline, stagger } from "animejs";
```

### Basic Animation
```javascript
anime({
  targets: ".element",
  translateX: 250,
  rotate: "1turn",
  duration: 800,
  easing: "easeInOutQuad"
});
```

## Performance Optimization

### Frame Rate Control
```javascript
// Adjust global frame rate for lower-end devices
anime.suspendWhenDocumentHidden = true;

// Control FPS for specific animations
anime({
  targets: ".element",
  translateX: 250,
  update: function(anim) {
    // Custom frame rate limiting if needed
  }
});
```

### Use Transforms Over Layout Properties
```javascript
// Good - uses GPU-accelerated transforms
anime({
  targets: ".element",
  translateX: 100,  // Good
  translateY: 50,   // Good
  scale: 1.2,       // Good
  rotate: 45,       // Good
  opacity: 0.5      // Good
});

// Avoid - causes layout recalculation
anime({
  targets: ".element",
  left: 100,        // Avoid
  top: 50,          // Avoid
  width: 200,       // Avoid
  height: 150       // Avoid
});
```

### Use Animatable for High-Frequency Updates
```javascript
import { Animatable } from "animejs";

// Optimized for continuous updates (mouse tracking, etc.)
const animatable = new Animatable(".cursor", {
  x: 0,
  y: 0
});

document.addEventListener("mousemove", (e) => {
  animatable.x = e.clientX;
  animatable.y = e.clientY;
});
```

## Timeline Animations

### Basic Timeline
```javascript
const tl = anime.timeline({
  easing: "easeOutExpo",
  duration: 750
});

tl.add({
  targets: ".header",
  translateY: [-50, 0],
  opacity: [0, 1]
})
.add({
  targets: ".content",
  translateY: [30, 0],
  opacity: [0, 1]
}, "-=500") // Overlap by 500ms
.add({
  targets: ".footer",
  translateY: [30, 0],
  opacity: [0, 1]
}, "-=500");
```

### Timeline Controls
```javascript
const tl = anime.timeline({
  autoplay: false
});

// Control methods
tl.play();
tl.pause();
tl.restart();
tl.reverse();
tl.seek(1000); // Go to 1 second
```

## Stagger Animations

### Basic Stagger
```javascript
anime({
  targets: ".grid-item",
  translateY: [50, 0],
  opacity: [0, 1],
  delay: anime.stagger(100) // 100ms delay between each
});
```

### Advanced Stagger Options
```javascript
// Stagger from center
anime({
  targets: ".grid-item",
  scale: [0, 1],
  delay: anime.stagger(100, { from: "center" })
});

// Grid stagger
anime({
  targets: ".grid-item",
  scale: [0, 1],
  delay: anime.stagger(50, {
    grid: [14, 5],
    from: "center"
  })
});

// Stagger with easing
anime({
  targets: ".item",
  translateX: 250,
  delay: anime.stagger(100, { easing: "easeOutQuad" })
});
```

## Easing Functions

### Built-in Easings
```javascript
// Common easings
anime({
  targets: ".element",
  translateX: 250,
  easing: "easeOutExpo"     // Fast start, slow end
  // easing: "easeInOutQuad" // Smooth both ends
  // easing: "easeOutElastic(1, .5)" // Bouncy
  // easing: "easeOutBounce" // Bounce effect
  // easing: "spring(1, 80, 10, 0)" // Physics-based
});
```

### Custom Easing
```javascript
anime({
  targets: ".element",
  translateX: 250,
  easing: "cubicBezier(0.25, 0.1, 0.25, 1)"
});
```

## SVG Animation

### Path Animation
```javascript
const path = anime.path(".motion-path");

anime({
  targets: ".element",
  translateX: path("x"),
  translateY: path("y"),
  rotate: path("angle"),
  easing: "linear",
  duration: 2000,
  loop: true
});
```

### Line Drawing
```javascript
anime({
  targets: "path",
  strokeDashoffset: [anime.setDashoffset, 0],
  easing: "easeInOutSine",
  duration: 1500,
  delay: anime.stagger(250)
});
```

### Morphing
```javascript
anime({
  targets: "path",
  d: [
    { value: "M10 10 L90 10 L90 90 L10 90 Z" },
    { value: "M10 50 Q50 10 90 50 Q50 90 10 50 Z" }
  ],
  easing: "easeInOutQuad",
  duration: 1000,
  loop: true,
  direction: "alternate"
});
```

## Function-Based Values

### Dynamic Values
```javascript
anime({
  targets: ".element",
  translateX: function(el, i) {
    return i * 100; // Each element moves further
  },
  rotate: function(el, i, total) {
    return (360 / total) * i; // Distribute rotation
  },
  delay: function(el, i) {
    return i * 50;
  }
});
```

## Callbacks and Events

### Animation Events
```javascript
anime({
  targets: ".element",
  translateX: 250,
  begin: function(anim) {
    console.log("Animation started");
  },
  update: function(anim) {
    console.log(Math.round(anim.progress) + "%");
  },
  complete: function(anim) {
    console.log("Animation completed");
  }
});
```

### Looping
```javascript
anime({
  targets: ".element",
  translateX: 250,
  direction: "alternate",
  loop: true,
  loopComplete: function(anim) {
    console.log("Loop completed");
  }
});
```

## React Integration

### Basic React Usage
```tsx
import { useEffect, useRef } from "react";
import anime from "animejs";

function AnimatedComponent() {
  const elementRef = useRef(null);

  useEffect(() => {
    const animation = anime({
      targets: elementRef.current,
      translateX: 250,
      duration: 800
    });

    return () => {
      animation.pause(); // Cleanup
    };
  }, []);

  return <div ref={elementRef}>Animated</div>;
}
```

### With useCallback for Controls
```tsx
function ControlledAnimation() {
  const elementRef = useRef(null);
  const animationRef = useRef(null);

  const playAnimation = useCallback(() => {
    animationRef.current = anime({
      targets: elementRef.current,
      translateX: [0, 250],
      duration: 800
    });
  }, []);

  useEffect(() => {
    return () => {
      animationRef.current?.pause();
    };
  }, []);

  return (
    <>
      <div ref={elementRef}>Animated</div>
      <button onClick={playAnimation}>Play</button>
    </>
  );
}
```

## Web Animations API Bridge

### Using WAAPI for Native Performance
```javascript
import { wapiAnimate } from "animejs";

// Uses browser's native Web Animations API
wapiAnimate(".element", {
  translateX: 250,
  duration: 800
});
```

## Accessibility

### Respect Reduced Motion
```javascript
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

anime({
  targets: ".element",
  translateX: 250,
  duration: prefersReducedMotion ? 0 : 800,
  easing: prefersReducedMotion ? "linear" : "easeOutExpo"
});
```

## Best Practices Summary

1. Use transforms (translate, scale, rotate) over layout properties
2. Import only needed modules for smaller bundle size
3. Use stagger for multiple element animations
4. Clean up animations on component unmount
5. Use Animatable for high-frequency updates
6. Leverage timeline for complex sequences
7. Use function-based values for dynamic animations
8. Respect reduced motion preferences
9. Consider WAAPI bridge for native performance
10. Test on lower-powered devices
