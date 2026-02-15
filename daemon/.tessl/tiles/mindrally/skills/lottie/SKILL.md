---
name: lottie
description: Expert guidelines for implementing performant Lottie animations on the web
---

# Lottie Animation Guidelines

You are an expert in Lottie animations, web performance, and JavaScript. Follow these guidelines when implementing Lottie animations.

## Core Principles

### Use dotLottie Format
- Prefer `.lottie` (dotLottie) format over `.json` - up to 90% smaller file size
- dotLottie bundles all assets (images, fonts) into a single compressed file
- Use the free dotLottie converter at lottiefiles.com

### Installation
```bash
# For React
npm install @lottiefiles/dotlottie-react

# For vanilla JS
npm install @lottiefiles/dotlottie-web
```

## React Implementation

### Basic Usage
```tsx
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

function Animation() {
  return (
    <DotLottieReact
      src="/animations/loading.lottie"
      loop
      autoplay
    />
  );
}
```

### Control Animation Playback
```tsx
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useState } from "react";

function ControlledAnimation() {
  const [dotLottie, setDotLottie] = useState(null);

  const dotLottieRefCallback = (dotLottie) => {
    setDotLottie(dotLottie);
  };

  return (
    <>
      <DotLottieReact
        src="/animation.lottie"
        dotLottieRefCallback={dotLottieRefCallback}
      />
      <button onClick={() => dotLottie?.play()}>Play</button>
      <button onClick={() => dotLottie?.pause()}>Pause</button>
      <button onClick={() => dotLottie?.stop()}>Stop</button>
    </>
  );
}
```

## Performance Optimization

### Lazy Loading
```tsx
import { useEffect, useRef, useState } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

function LazyLottie({ src }) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {isVisible && <DotLottieReact src={src} autoplay loop />}
    </div>
  );
}
```

### Choose the Right Renderer
```tsx
// SVG renderer - best quality, good for simple animations
<DotLottieReact src="/animation.lottie" renderer="svg" />

// Canvas renderer - better performance for complex animations
<DotLottieReact src="/animation.lottie" renderer="canvas" />

// Use canvas for:
// - Complex animations with many elements
// - Lower-powered devices
// - Animations with filters/effects
```

### Reduce DOM Elements
- Reuse identical graphic elements in After Effects
- Simplify paths and reduce keyframes
- Avoid unnecessary layers
- Target under 1000 DOM elements per animation

## Animation Design Best Practices

### Avoid Performance-Heavy Features
```
AVOID:
- Masks (use alpha matte sparingly)
- Complex blur effects
- 3D layers
- Expressions
- Uncompressed images
- Large image assets

PREFER:
- Simple shapes (fills, strokes)
- Transform animations (position, scale, rotation)
- Opacity changes
- Path animations
```

### Optimize Images in Animations
```
- Compress images to match display size
- If max display is 400x400, don't use 1000x1000 images
- Use vector graphics when possible
- Consider converting images to shapes
```

## Interactivity

### Cursor/Mouse Interaction
```tsx
<DotLottieReact
  src="/hover-animation.lottie"
  playMode="hover"
/>
```

### Scroll-Linked Animation
```tsx
import { useScroll, useTransform } from "motion/react";

function ScrollLottie() {
  const { scrollYProgress } = useScroll();
  const [dotLottie, setDotLottie] = useState(null);

  useEffect(() => {
    if (!dotLottie) return;

    const unsubscribe = scrollYProgress.on("change", (progress) => {
      dotLottie.setFrame(progress * dotLottie.totalFrames);
    });

    return unsubscribe;
  }, [dotLottie, scrollYProgress]);

  return (
    <DotLottieReact
      src="/scroll-animation.lottie"
      dotLottieRefCallback={setDotLottie}
      autoplay={false}
    />
  );
}
```

### Segment Playback
```tsx
function SegmentAnimation() {
  const [dotLottie, setDotLottie] = useState(null);

  const playSegment = (start, end) => {
    dotLottie?.setSegment(start, end);
    dotLottie?.play();
  };

  return (
    <>
      <DotLottieReact
        src="/multi-state.lottie"
        dotLottieRefCallback={setDotLottie}
        autoplay={false}
      />
      <button onClick={() => playSegment(0, 30)}>State 1</button>
      <button onClick={() => playSegment(30, 60)}>State 2</button>
    </>
  );
}
```

## Accessibility

### Respect Reduced Motion
```tsx
function AccessibleAnimation() {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (prefersReducedMotion) {
    return <img src="/static-fallback.svg" alt="Animation description" />;
  }

  return (
    <DotLottieReact
      src="/animation.lottie"
      autoplay
      loop
      aria-label="Decorative loading animation"
    />
  );
}
```

### Provide Fallbacks
```tsx
function AnimationWithFallback() {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <img src="/fallback.gif" alt="Animation" />;
  }

  return (
    <DotLottieReact
      src="/animation.lottie"
      autoplay
      onError={() => setHasError(true)}
    />
  );
}
```

## Loading Strategy

### Use Preloader for Large Animations
```tsx
function AnimationWithPreloader() {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="animation-container">
      {!isLoaded && (
        <img src="/first-frame.webp" alt="" className="preloader" />
      )}
      <DotLottieReact
        src="/large-animation.lottie"
        onLoad={() => setIsLoaded(true)}
        style={{ opacity: isLoaded ? 1 : 0 }}
        autoplay
      />
    </div>
  );
}
```

## File Size Guidelines

| Animation Complexity | Target Size | Max DOM Elements |
|---------------------|-------------|------------------|
| Simple icons        | < 10KB      | < 100           |
| UI animations       | < 50KB      | < 500           |
| Complex scenes      | < 150KB     | < 1500          |
| Hero animations     | < 300KB     | < 2500          |

## Cleanup

### Proper Cleanup in React
```tsx
useEffect(() => {
  return () => {
    dotLottie?.destroy();
  };
}, [dotLottie]);
```

## Best Practices Summary

1. Use dotLottie format for smaller file sizes
2. Lazy load animations not in viewport
3. Use canvas renderer for complex animations
4. Avoid masks, blurs, and expressions
5. Compress and optimize image assets
6. Respect reduced motion preferences
7. Provide static fallbacks for errors
8. Clean up animations on unmount
9. Keep DOM element count low
10. Use preloaders for large animations
