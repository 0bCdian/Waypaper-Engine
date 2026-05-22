<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

/** Max tilt in degrees — subtle motion for brand mark readability */
const MAX = 11;

const hit = ref<HTMLElement | null>(null);

/** Respect reduced motion via JS (skip handlers) once hydrated */
const interactionEnabled = ref(false);

let mqDispose: (() => void) | null = null;

onMounted(() => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  interactionEnabled.value = !mq.matches;
  const onChange = () => {
    interactionEnabled.value = !mq.matches;
    if (!interactionEnabled.value) tilt.value = { x: 0, y: 0 };
  };
  mq.addEventListener("change", onChange);
  mqDispose = () => mq.removeEventListener("change", onChange);
});

onUnmounted(() => mqDispose?.());

/** Normalized offsets in [-1, 1]; zero when pointer leaves */
const tilt = ref({ x: 0, y: 0 });

function onMove(e: MouseEvent) {
  if (!interactionEnabled.value) return;
  const el = hit.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
  const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
  tilt.value = {
    x: Math.max(-1, Math.min(1, nx)),
    y: Math.max(-1, Math.min(1, ny)),
  };
}

function onLeave() {
  tilt.value = { x: 0, y: 0 };
}

const tiltStyle = computed(() => {
  const { x, y } = tilt.value;
  const ry = x * MAX;
  const rx = -y * MAX * 0.85;
  return {
    transform: `perspective(640px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`,
    transition:
      tilt.value.x === 0 && tilt.value.y === 0
        ? "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)"
        : "transform 0.12s cubic-bezier(0.22, 1, 0.36, 1)",
  };
});
</script>

<template>
  <div
    ref="hit"
    class="hero-parallax"
    :class="{ 'hero-parallax--interactive': interactionEnabled }"
    aria-hidden="true"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <div class="hero-parallax__tilt" :style="tiltStyle">
      <img class="hero-parallax__img" src="/logo.png" alt="" width="320" height="320" draggable="false" />
    </div>
  </div>
</template>

<style scoped>
.hero-parallax {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  place-items: center;
  overflow: visible;
}

.hero-parallax--interactive {
  cursor: grab;
}

.hero-parallax--interactive:active {
  cursor: grabbing;
}

.hero-parallax__tilt {
  transform-style: preserve-3d;
  will-change: transform;
}

.hero-parallax__img {
  display: block;
  max-width: 192px;
  max-height: 192px;
  width: auto;
  height: auto;
  pointer-events: none;
  filter: drop-shadow(0 10px 24px rgb(0 0 0 / 0.08));
}

:global(html.dark) .hero-parallax__img {
  filter: drop-shadow(0 12px 28px rgb(0 0 0 / 0.38));
}

@media (min-width: 640px) {
  .hero-parallax__img {
    max-width: 256px;
    max-height: 256px;
  }
}

@media (min-width: 960px) {
  .hero-parallax__img {
    max-width: 320px;
    max-height: 320px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-parallax__tilt {
    transform: none !important;
    transition: none !important;
  }
}
</style>
