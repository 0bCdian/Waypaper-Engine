<script setup lang="ts">
import { ref, computed } from "vue";

type Method = "arch" | "appimage" | "source";

const method = ref<Method>("arch");
const copied = ref<string | null>(null);

const blocks: Record<Method, { label: string; lines: string[]; note?: string }> = {
  arch: {
    label: "Arch / AUR",
    lines: [
      "yay -S waypaper-engine",
      "systemctl --user enable --now waypaper-daemon",
      "waypaper-engine",
    ],
    note: "Installs the daemon, GUI, .desktop file, and systemd user unit.",
  },
  appimage: {
    label: "AppImage",
    lines: [
      "curl -LO https://github.com/0bCdian/Waypaper-Engine/releases/latest/download/Waypaper-Engine.AppImage",
      "chmod +x Waypaper-Engine.AppImage",
      "./Waypaper-Engine.AppImage",
    ],
    note: "Single portable file. No FUSE quirks on most distros.",
  },
  source: {
    label: "From source",
    lines: [
      "git clone https://github.com/0bCdian/Waypaper-Engine",
      "cd Waypaper-Engine && mise install",
      "make electron && make daemon && make install",
    ],
    note: "Requires Node 22, pnpm 9, Go 1.26.",
  },
};

const active = computed(() => blocks[method.value]);

const copy = async (line: string) => {
  try {
    await navigator.clipboard.writeText(line);
    copied.value = line;
    setTimeout(() => {
      if (copied.value === line) copied.value = null;
    }, 1400);
  } catch {
    /* clipboard blocked — ignore */
  }
};
</script>

<template>
  <section class="tryit">
    <header class="tryit__head">
      <span class="tryit__prompt">$</span>
      <h2 class="tryit__title">Try it</h2>
      <span class="tryit__rule" aria-hidden="true" />
    </header>

    <div class="tryit__panel">
      <div class="tryit__tabs" role="tablist">
        <button
          v-for="(b, key) in blocks"
          :key="key"
          role="tab"
          :aria-selected="method === key"
          :class="['tryit__tab', { 'tryit__tab--active': method === key }]"
          @click="method = key as Method"
        >
          {{ b.label }}
        </button>
      </div>

      <div class="tryit__terminal" role="tabpanel">
        <div class="tryit__chrome">
          <span class="tryit__dot tryit__dot--r" />
          <span class="tryit__dot tryit__dot--y" />
          <span class="tryit__dot tryit__dot--g" />
          <span class="tryit__chrome-label">~ / install</span>
        </div>
        <ol class="tryit__lines">
          <li v-for="line in active.lines" :key="line" class="tryit__line">
            <span class="tryit__line-prompt">$</span>
            <code class="tryit__code">{{ line }}</code>
            <button
              class="tryit__copy"
              :aria-label="`Copy: ${line}`"
              @click="copy(line)"
            >
              {{ copied === line ? "copied" : "copy" }}
            </button>
          </li>
        </ol>
        <p class="tryit__note">{{ active.note }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tryit {
  max-width: 1152px;
  margin: 4rem auto 1.75rem;
  padding: 0 1.5rem;
  position: relative;
  z-index: 1;
}

.tryit__head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.4rem;
}
.tryit__prompt {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  font-size: 1.15rem;
}
.tryit__title {
  font-family: "Space Grotesk", "Inter", system-ui, sans-serif;
  font-weight: 600;
  font-size: 1.6rem;
  letter-spacing: -0.018em;
  margin: 0;
  color: var(--vp-c-text-1);
}
.tryit__rule {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, var(--vp-c-divider), transparent);
}

/* Install panel */
.tryit__panel {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.tryit__tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
.tryit__tab {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 0.55rem 1rem;
  margin-bottom: -1px;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 140ms ease, border-color 140ms ease;
}
.tryit__tab:hover { color: var(--vp-c-text-1); }
.tryit__tab--active {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand-1);
}

.tryit__terminal {
  border: 1px solid var(--vp-c-divider);
  border-top: 0;
  border-radius: 0 0 6px 6px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}
.tryit__chrome {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
  background: var(--vp-c-bg-alt);
  border-bottom: 1px solid var(--vp-c-divider);
}
.tryit__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}
.tryit__dot--r { background: #c44a4a; opacity: 0.65; }
.tryit__dot--y { background: #c39200; opacity: 0.65; }
.tryit__dot--g { background: #6f8c00; opacity: 0.75; }
.tryit__chrome-label {
  margin-left: auto;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
}

.tryit__lines {
  list-style: none;
  margin: 0;
  padding: 0.9rem 1rem 0.4rem;
}
.tryit__line {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.18rem 0;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.84rem;
  line-height: 1.55;
}
.tryit__line-prompt {
  color: var(--vp-c-brand-1);
  font-weight: 600;
  user-select: none;
  flex-shrink: 0;
}
.tryit__code {
  color: var(--vp-c-text-1);
  background: transparent;
  border: 0;
  padding: 0;
  flex: 1;
  word-break: break-all;
  font-size: inherit;
}
.tryit__copy {
  appearance: none;
  background: transparent;
  border: 1px solid transparent;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  padding: 0.1rem 0.45rem;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 140ms ease, color 140ms ease, border-color 140ms ease;
}
.tryit__line:hover .tryit__copy,
.tryit__copy:focus-visible {
  opacity: 1;
}
.tryit__copy:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.tryit__note {
  margin: 0.4rem 0 0;
  padding: 0.55rem 1rem 0.85rem;
  font-family: "Inter", system-ui, sans-serif;
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  border-top: 1px dashed var(--vp-c-divider);
}
</style>
