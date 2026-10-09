<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import palettes from "virtual:wp-palettes";

const KEY = "wp-docs-theme";
const current = ref("gruvbox-material");
const open = ref(false);
const root = ref<HTMLElement>();

const groups = [
  { label: "Dark", items: palettes.filter((p) => p.category === "dark") },
  { label: "Light", items: palettes.filter((p) => p.category === "light") },
];
const currentName = computed(
  () => palettes.find((p) => p.name === current.value)?.displayName ?? current.value,
);

function apply(name: string) {
  current.value = name;
  document.documentElement.dataset.theme = name;
  try {
    localStorage.setItem(KEY, name);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
  open.value = false;
}

onMounted(() => {
  // The inline head script set the attribute; fall back if it names a removed palette.
  const set = document.documentElement.dataset.theme ?? "";
  if (palettes.some((p) => p.name === set)) current.value = set;
  else apply("gruvbox-material");
});
</script>

<template>
  <div
    ref="root"
    class="picker"
    @keydown.esc="open = false"
    @focusout="(e) => !root?.contains(e.relatedTarget as Node) && (open = false)"
  >
    <button
      type="button"
      class="picker__btn"
      :aria-expanded="open"
      aria-haspopup="true"
      aria-label="Change colour palette"
      @click="open = !open"
    >
      <span class="swatch" aria-hidden="true"><i /><i /><i /></span>
      <span class="picker__name">{{ currentName }}</span>
    </button>
    <div v-if="open" class="picker__menu">
      <template v-for="g in groups" :key="g.label">
        <p class="picker__group">{{ g.label }}</p>
        <button
          v-for="p in g.items"
          :key="p.name"
          type="button"
          class="picker__item"
          :data-theme="p.name"
          :aria-pressed="p.name === current"
          @click="apply(p.name)"
        >
          <span class="swatch" aria-hidden="true"><i /><i /><i /></span>
          {{ p.displayName }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
}
.picker__btn,
.picker__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--color-base-300);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
}
.picker__btn {
  height: 2.25rem;
  padding: 0 0.6rem;
}
.picker__btn:hover,
.picker__btn[aria-expanded="true"] {
  border-color: var(--color-primary);
}
.picker__name {
  display: none;
}
@media (min-width: 720px) {
  .picker__name {
    display: inline;
  }
}
.picker__menu {
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  z-index: 60;
  width: min(18rem, calc(100vw - 2rem));
  max-height: 70vh;
  overflow-y: auto;
  padding: 0.5rem;
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 0.35);
}
.picker__group {
  margin: 0.5rem 0 0.35rem;
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-base-content) 70%, var(--color-base-100));
}
.picker__group:first-child {
  margin-top: 0;
}
/* each item carries its own data-theme, so the vars below are that palette's colours */
.picker__item {
  width: 100%;
  margin-bottom: 0.25rem;
  padding: 0.4rem 0.5rem;
  background: var(--color-base-100);
  color: var(--color-base-content);
  text-align: left;
}
.picker__item:hover {
  border-color: var(--color-primary);
}
.picker__item[aria-pressed="true"] {
  border-color: var(--color-primary);
  box-shadow: inset 3px 0 0 var(--color-primary);
}
.swatch {
  display: inline-flex;
  flex: none;
  border: 1px solid var(--color-base-300);
}
.swatch i {
  width: 0.7rem;
  height: 1.1rem;
}
.swatch i:nth-child(1) {
  background: var(--color-base-100);
}
.swatch i:nth-child(2) {
  background: var(--color-primary);
}
.swatch i:nth-child(3) {
  background: var(--color-accent);
}
</style>
