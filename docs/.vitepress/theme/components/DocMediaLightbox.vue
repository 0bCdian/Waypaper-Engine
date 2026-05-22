<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vitepress";

type Box =
  | { kind: "closed" }
  | { kind: "image"; src: string; alt: string }
  | { kind: "video"; src: string; poster?: string };

const state = ref<Box>({ kind: "closed" });
const route = useRoute();

function close() {
  state.value = { kind: "closed" };
  document.documentElement.classList.remove("doc-media-lightbox-open");
}

function mediaFromEventTarget(target: EventTarget | null): HTMLImageElement | HTMLVideoElement | null {
  const el =
    target instanceof Element ? target : target instanceof Text ? target.parentElement : null;
  const node = el?.closest("img, video");
  if (node instanceof HTMLImageElement || node instanceof HTMLVideoElement) return node;
  return null;
}

function openFromMedia(media: HTMLImageElement | HTMLVideoElement, ev: MouseEvent) {
  if (!media.closest(".vp-doc")) return;
  if (media.closest(".hero-parallax")) return;
  if (media.hasAttribute("data-no-lightbox")) return;

  if (media instanceof HTMLImageElement) {
    const src = media.currentSrc || media.src;
    if (!src || src.startsWith("data:")) return;
    ev.preventDefault();
    ev.stopPropagation();
    state.value = { kind: "image", src, alt: media.alt || "" };
    document.documentElement.classList.add("doc-media-lightbox-open");
    return;
  }

  const src = media.currentSrc || media.src;
  if (!src) return;
  ev.preventDefault();
  ev.stopPropagation();
  const poster = media.getAttribute("poster") || undefined;
  state.value = { kind: "video", src, poster };
  document.documentElement.classList.add("doc-media-lightbox-open");
}

function onClickCapture(ev: MouseEvent) {
  if (ev.defaultPrevented) return;
  if (ev.button !== 0) return;
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

  const media = mediaFromEventTarget(ev.target);
  if (!media) return;
  openFromMedia(media, ev);
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === "Escape" && state.value.kind !== "closed") {
    ev.preventDefault();
    close();
  }
}

onMounted(() => {
  document.addEventListener("click", onClickCapture, true);
  document.addEventListener("keydown", onKeydown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onClickCapture, true);
  document.removeEventListener("keydown", onKeydown, true);
  document.documentElement.classList.remove("doc-media-lightbox-open");
});

watch(
  () => route.path,
  () => {
    if (state.value.kind !== "closed") close();
  },
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.kind !== 'closed'"
      class="doc-media-lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="state.kind === 'image' ? 'Expanded image' : 'Expanded video'"
      @click.self="close"
    >
      <button type="button" class="doc-media-lightbox__close" aria-label="Close" @click="close">
        ✕
      </button>
      <img
        v-if="state.kind === 'image'"
        class="doc-media-lightbox__media doc-media-lightbox__media--img"
        :src="state.src"
        :alt="state.alt"
      />
      <video
        v-else-if="state.kind === 'video'"
        class="doc-media-lightbox__media doc-media-lightbox__media--video"
        controls
        playsinline
        :poster="state.poster"
        :src="state.src"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.doc-media-lightbox {
  position: fixed;
  inset: 0;
  z-index: calc(var(--vp-z-index-local-nav, 200) + 100);
  display: grid;
  place-items: center;
  padding: clamp(0.75rem, 4vw, 2rem);
  background: rgb(61 72 77 / 0.78);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: doc-media-lightbox-in 0.18s ease-out;
}

@keyframes doc-media-lightbox-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.doc-media-lightbox__close {
  position: absolute;
  top: clamp(0.5rem, 2vw, 1rem);
  right: clamp(0.5rem, 2vw, 1rem);
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider, rgb(255 255 255 / 0.35));
  background: var(--vp-c-bg-elv, #fdf6e3);
  color: var(--vp-c-text-1, #3d484d);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
  box-shadow: 0 4px 18px rgb(0 0 0 / 0.18);
}

.doc-media-lightbox__close:hover {
  border-color: var(--vp-c-brand-1, #6f8c00);
  color: var(--vp-c-brand-1, #6f8c00);
}

.doc-media-lightbox__close:focus-visible {
  outline: 2px solid var(--vp-c-brand-1, #6f8c00);
  outline-offset: 2px;
}

.doc-media-lightbox__media {
  max-width: min(96vw, 1200px);
  max-height: min(88vh, 900px);
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 10px;
  box-shadow:
    0 24px 60px rgb(0 0 0 / 0.35),
    0 0 0 1px rgb(255 255 255 / 0.08);
  background: rgb(0 0 0 / 0.35);
}

.doc-media-lightbox__media--video {
  width: min(96vw, 1200px);
  max-height: min(88vh, 900px);
}
</style>
