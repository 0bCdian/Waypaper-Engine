<script setup lang="ts">
import { ref } from "vue";

// Verified against Makefile, README.md, waypaper-daemon.service and electron-builder.json.
const methods = [
  {
    id: "arch",
    label: "Arch / AUR",
    lines: ["yay -S waypaper-engine", "systemctl --user enable --now waypaper-daemon.service"],
  },
  {
    id: "appimage",
    label: "AppImage",
    lines: [
      "curl -LO https://github.com/0bCdian/Waypaper-Engine/releases/latest/download/waypaper-engine.AppImage",
      "chmod +x waypaper-engine.AppImage",
      "./waypaper-engine.AppImage",
    ],
  },
  {
    id: "source",
    label: "From source",
    lines: [
      "git clone https://github.com/0bCdian/Waypaper-Engine.git",
      "cd Waypaper-Engine",
      "make deps && make electron && make install",
    ],
  },
];

const active = ref(methods[0]);
const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(active.value.lines.join("\n"));
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    /* clipboard blocked: the text is still selectable */
  }
}
</script>

<template>
  <div class="install">
    <div class="install__bar">
      <div class="install__tabs" role="tablist">
        <button
          v-for="m in methods"
          :key="m.id"
          type="button"
          role="tab"
          :aria-selected="m.id === active.id"
          class="install__tab"
          @click="((active = m), (copied = false))"
        >
          {{ m.label }}
        </button>
      </div>
      <button type="button" class="install__copy" @click="copy">
        {{ copied ? "copied" : "copy" }}
      </button>
    </div>
    <!-- All panels share one grid cell so the box keeps the tallest panel's height on tab switch. -->
    <div class="install__panels">
      <pre
        v-for="m in methods"
        :key="m.id"
        class="install__code"
        :class="{ 'is-hidden': m.id !== active.id }"
        role="tabpanel"
        :aria-hidden="m.id !== active.id"
        :tabindex="m.id === active.id ? 0 : -1"
      ><code><span v-for="l in m.lines" :key="l" class="install__line">{{ l }}
</span></code></pre>
    </div>
    <span class="sr-only" aria-live="polite">{{ copied ? "Copied to clipboard" : "" }}</span>
  </div>
</template>

<style scoped>
.install {
  border: 1px solid var(--color-base-300);
  background: var(--color-base-200);
  min-width: 0;
}
.install__bar {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-base-300);
}
.install__tabs {
  display: flex;
  overflow-x: auto;
}
.install__tab,
.install__copy {
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--color-base-content) 75%, var(--color-base-100));
  font: inherit;
  font-size: 0.8125rem;
  padding: 0.55rem 0.9rem;
  cursor: pointer;
  white-space: nowrap;
}
.install__tab {
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.install__tab[aria-selected="true"] {
  color: var(--color-base-content);
  border-bottom-color: var(--color-primary);
}
.install__tab:hover,
.install__copy:hover {
  color: var(--color-primary);
}
.install__copy {
  border-left: 1px solid var(--color-base-300);
}
.install__panels {
  display: grid;
}
.install__code {
  grid-area: 1 / 1;
  min-width: 0;
  margin: 0;
  padding: 1rem;
  overflow-x: auto;
  font-size: 0.8125rem;
  line-height: 1.7;
}
.install__code.is-hidden {
  visibility: hidden;
}
.install__line::before {
  content: "$ ";
  color: var(--color-primary);
  user-select: none;
}
</style>
