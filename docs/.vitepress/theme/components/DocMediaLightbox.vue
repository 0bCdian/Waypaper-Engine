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

function mediaFromEventTarget(
  target: EventTarget | null,
): HTMLImageElement | HTMLVideoElement | null {
  const el =
    target instanceof Element ? target : target instanceof Text ? target.parentElement : null;
  const node = el?.closest("img, video");
  if (node instanceof HTMLImageElement || node instanceof HTMLVideoElement) return node;
  return null;
}

function openFromMedia(media: HTMLImageElement | HTMLVideoElement, ev: MouseEvent) {
  if (!media.closest(".vp-doc")) return;
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
  z-index: 200;
  display: grid;
  place-items: center;
  padding: clamp(0.75rem, 4vw, 2rem);
  background: color-mix(in srgb, var(--color-base-100) 88%, transparent);
}

.doc-media-lightbox__close {
  position: absolute;
  top: clamp(0.5rem, 2vw, 1rem);
  right: clamp(0.5rem, 2vw, 1rem);
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--color-base-300);
  background: var(--color-base-200);
  color: var(--color-base-content);
  font: inherit;
  cursor: pointer;
}

.doc-media-lightbox__close:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.doc-media-lightbox__media {
  max-width: min(96vw, 1200px);
  max-height: min(88vh, 900px);
  width: auto;
  height: auto;
  object-fit: contain;
  border: 1px solid var(--color-base-300);
  background: var(--color-base-200);
}

.doc-media-lightbox__media--video {
  width: min(96vw, 1200px);
}
</style>
