<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { onContentUpdated, useData, useRoute, withBase } from "vitepress";
import DocMediaLightbox from "./components/DocMediaLightbox.vue";
import Home from "./components/Home.vue";
import ThemePicker from "./components/ThemePicker.vue";

// Search UI is VitePress's own (pinned vitepress@1.6.3); styled via --vp-* vars in style.css.
const SearchBox = defineAsyncComponent(
  () => import("vitepress/dist/client/theme-default/components/VPLocalSearchBox.vue"),
);

interface Link {
  text: string;
  link: string;
}
interface Group {
  text: string;
  items: Link[];
}

const { theme, page, frontmatter } = useData();
const route = useRoute();

const nav = computed<Link[]>(() => theme.value.nav ?? []);
const groups = computed<Group[]>(() => theme.value.sidebar ?? []);
const github = computed(
  () => theme.value.socialLinks?.find((s: { icon: unknown }) => s.icon === "github")?.link,
);
const isHome = computed(() => frontmatter.value.layout === "home");

const clean = (p: string) => p.replace(/(index)?\.(md|html)$/, "").replace(/\/$/, "") || "/";
const here = computed(() => clean("/" + page.value.relativePath));
const isActive = (link: string) => clean(link) === here.value;
const inSection = (link: string) => here.value.startsWith("/" + link.split("/")[1] + "/");

const flat = computed(() => groups.value.flatMap((g) => g.items));
const idx = computed(() => flat.value.findIndex((i) => isActive(i.link)));
const prev = computed(() => (idx.value > 0 ? flat.value[idx.value - 1] : null));
const next = computed(() =>
  idx.value >= 0 && idx.value < flat.value.length - 1 ? flat.value[idx.value + 1] : null,
);

const headers = ref<{ level: number; title: string; link: string }[]>([]);
const activeHash = ref("");

const menuOpen = ref(false);
const searchOpen = ref(false);
watch(
  () => route.path,
  () => (menuOpen.value = false),
);

function onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    searchOpen.value = !searchOpen.value;
  }
}

function onCopyClick(e: MouseEvent) {
  const btn = (e.target as Element).closest<HTMLButtonElement>(
    "div[class*='language-'] > button.copy",
  );
  const code = btn?.parentElement?.querySelector("pre code");
  if (!btn || !code) return;
  navigator.clipboard
    ?.writeText(code.textContent ?? "")
    .then(() => {
      btn.classList.add("copied");
      setTimeout(() => btn.classList.remove("copied"), 1500);
    })
    .catch(() => {});
}

function spy() {
  let cur = "";
  for (const h of headers.value) {
    const el = document.getElementById(h.link.slice(1));
    if (el && el.getBoundingClientRect().top < 120) cur = h.link;
  }
  // Short final sections never reach the top; at the page bottom the last heading wins.
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  if (atBottom && headers.value.length) cur = headers.value[headers.value.length - 1].link;
  activeHash.value = cur;
}

onContentUpdated(() => {
  headers.value = [...document.querySelectorAll<HTMLElement>(".vp-doc :is(h2, h3)[id]")].map(
    (h) => ({
      level: Number(h.tagName[1]),
      title: (h.textContent ?? "").replace(/\u200B/g, "").trim(),
      link: "#" + h.id,
    }),
  );
  spy();
});

onMounted(() => {
  window.addEventListener("keydown", onKey);
  window.addEventListener("scroll", spy, { passive: true });
  document.addEventListener("click", onCopyClick);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("scroll", spy);
  document.removeEventListener("click", onCopyClick);
});
</script>

<template>
  <a class="skip" href="#main">Skip to content</a>

  <header class="hdr">
    <button
      v-if="!isHome"
      type="button"
      class="hdr__menu"
      :aria-expanded="menuOpen"
      aria-controls="sidebar"
      aria-label="Toggle menu"
      @click="menuOpen = !menuOpen"
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M1 3.5h14M1 8h14M1 12.5h14" stroke="currentColor" stroke-width="1.5" fill="none" />
      </svg>
    </button>
    <a class="hdr__brand" :href="withBase('/')">Waypaper Engine</a>
    <nav class="hdr__nav" aria-label="Sections">
      <a
        v-for="n in nav"
        :key="n.link"
        :href="withBase(n.link)"
        :aria-current="inSection(n.link) ? 'true' : undefined"
        >{{ n.text }}</a
      >
    </nav>
    <div class="hdr__tools">
      <button type="button" class="hdr__search" aria-label="Search" @click="searchOpen = true">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5" fill="none" />
          <path d="m10.5 10.5 4 4" stroke="currentColor" stroke-width="1.5" />
        </svg>
        <span class="hdr__search-label">Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <ThemePicker />
      <a v-if="github" class="hdr__icon" :href="github" aria-label="GitHub">
        <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.34.66.07-.52.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z"
          />
        </svg>
      </a>
    </div>
  </header>

  <Home v-if="isHome" id="main" />

  <div v-else class="shell">
    <aside id="sidebar" class="side" :class="{ 'side--open': menuOpen }">
      <nav aria-label="Chapters">
        <section v-for="g in groups" :key="g.text">
          <h2 class="side__title">{{ g.text }}</h2>
          <ul>
            <li v-for="i in g.items" :key="i.link">
              <a :href="withBase(i.link)" :aria-current="isActive(i.link) ? 'page' : undefined">{{
                i.text
              }}</a>
            </li>
          </ul>
        </section>
      </nav>
    </aside>

    <main id="main" class="main">
      <div v-if="page.isNotFound" class="vp-doc">
        <h1>404</h1>
        <p>That page does not exist. Try the <a :href="withBase('/manual/install')">manual</a>.</p>
      </div>
      <template v-else>
        <div class="vp-doc"><Content /></div>
        <nav v-if="prev || next" class="pager" aria-label="Chapter navigation">
          <a v-if="prev" class="pager__prev" :href="withBase(prev.link)">
            <small>Previous</small>{{ prev.text }}
          </a>
          <a v-if="next" class="pager__next" :href="withBase(next.link)">
            <small>Next</small>{{ next.text }}
          </a>
        </nav>
      </template>
    </main>

    <aside v-if="headers.length" class="outline" aria-label="On this page">
      <p class="outline__title">On this page</p>
      <ul>
        <li v-for="h in headers" :key="h.link" :class="{ sub: h.level > 2 }">
          <a
            :href="h.link"
            :aria-current="h.link === activeHash ? 'true' : undefined"
            v-html="h.title"
          />
        </li>
      </ul>
    </aside>
  </div>

  <footer class="foot">
    <p>{{ theme.footer?.message }}</p>
  </footer>

  <DocMediaLightbox />
  <SearchBox v-if="searchOpen" @close="searchOpen = false" />
</template>

<style scoped>
.skip {
  position: absolute;
  left: 0.5rem;
  top: -4rem;
  z-index: 100;
  padding: 0.5rem 0.75rem;
  background: var(--color-primary);
  color: var(--color-primary-content);
}
.skip:focus {
  top: 0.5rem;
}

/* header */
.hdr {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: var(--hdr-h);
  padding: 0 0.75rem;
  background: var(--color-base-100);
  border-bottom: 1px solid var(--color-base-300);
}
.hdr__brand {
  font-family: var(--font-display);
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
}
.hdr__nav {
  display: none;
  gap: 1.25rem;
  margin-left: 1.5rem;
  font-family: var(--font-display);
  font-size: 0.9375rem;
}
.hdr__nav a {
  color: color-mix(in srgb, var(--color-base-content) 75%, var(--color-base-100));
  text-decoration: none;
}
.hdr__nav a:hover,
.hdr__nav a[aria-current] {
  color: var(--color-base-content);
}
.hdr__nav a[aria-current] {
  text-decoration: underline solid var(--color-primary) 2px;
  text-underline-offset: 0.5rem;
}
.hdr__tools {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
}
.hdr__menu,
.hdr__search,
.hdr__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 2.25rem;
  min-width: 2.25rem;
  border: 1px solid var(--color-base-300);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
}
.hdr__icon {
  border-color: transparent;
}
.hdr__menu:hover,
.hdr__search:hover,
.hdr__icon:hover {
  border-color: var(--color-primary);
}
.hdr__search-label,
.hdr__search kbd {
  display: none;
}
.hdr__search kbd {
  font-size: 0.6875rem;
  padding: 0 0.3rem;
  border: 1px solid var(--color-base-300);
  color: color-mix(in srgb, var(--color-base-content) 70%, var(--color-base-100));
}
@media (min-width: 720px) {
  .hdr__search {
    padding: 0 0.6rem;
  }
  .hdr__search-label,
  .hdr__search kbd {
    display: inline;
  }
}
@media (min-width: 960px) {
  .hdr {
    padding: 0 1.5rem;
  }
  .hdr__menu {
    display: none;
  }
  .hdr__nav {
    display: flex;
  }
}

/* shell: sidebar | content | outline */
.shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
  max-width: 90rem;
  margin: 0 auto;
}
.side {
  position: fixed;
  inset: var(--hdr-h) 0 0 0;
  z-index: 40;
  display: none;
  overflow-y: auto;
  padding: 1.25rem 1rem 3rem;
  background: var(--color-base-100);
}
.side--open {
  display: block;
}
.side section + section {
  margin-top: 1.5rem;
}
.side__title {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-base-content) 70%, var(--color-base-100));
}
.side ul,
.outline ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.side a {
  display: block;
  padding: 0.3rem 0.75rem;
  border-left: 1px solid var(--color-base-300);
  font-family: var(--font-display);
  font-size: 0.9375rem;
  color: color-mix(in srgb, var(--color-base-content) 82%, var(--color-base-100));
  text-decoration: none;
}
.side a:hover {
  color: var(--color-base-content);
  border-left-color: var(--color-primary);
}
.side a[aria-current] {
  color: var(--color-base-content);
  font-weight: 600;
  border-left: 3px solid var(--color-primary);
  padding-left: calc(0.75rem - 2px);
  background: var(--color-base-200);
}
.main {
  min-width: 0;
  padding: 2rem 1rem 3rem;
}
.main > * {
  max-width: 72ch;
  margin-inline: auto;
}
.outline {
  display: none;
}
.pager {
  display: grid;
  gap: 0.75rem;
  margin-top: 3rem;
}
.pager a {
  display: block;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-base-300);
  font-family: var(--font-display);
  color: inherit;
  text-decoration: none;
}
.pager a:hover {
  border-color: var(--color-primary);
}
.pager small {
  display: block;
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-base-content) 70%, var(--color-base-100));
}
.pager__next {
  text-align: right;
}
@media (min-width: 640px) {
  .pager {
    grid-template-columns: 1fr 1fr;
  }
  .pager__next {
    grid-column: 2;
  }
}
@media (min-width: 960px) {
  .shell {
    grid-template-columns: 17rem minmax(0, 1fr);
  }
  .side {
    position: sticky;
    inset: auto;
    top: var(--hdr-h);
    z-index: auto;
    display: block;
    height: calc(100vh - var(--hdr-h));
    padding: 1.5rem 1rem 3rem 1.5rem;
    border-right: 1px solid var(--color-base-300);
  }
  .main {
    padding: 2.5rem 2rem 4rem;
  }
}
@media (min-width: 1280px) {
  .shell {
    grid-template-columns: 17rem minmax(0, 1fr) 16rem;
  }
  .outline {
    display: block;
    position: sticky;
    top: var(--hdr-h);
    align-self: start;
    max-height: calc(100vh - var(--hdr-h));
    overflow-y: auto;
    padding: 2.5rem 1.5rem 2rem 0;
    font-size: 0.8125rem;
  }
  .outline__title {
    margin: 0 0 0.6rem;
    font-family: var(--font-display);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color-base-content) 70%, var(--color-base-100));
  }
  .outline a {
    display: block;
    padding: 0.2rem 0 0.2rem 0.75rem;
    border-left: 1px solid var(--color-base-300);
    color: color-mix(in srgb, var(--color-base-content) 78%, var(--color-base-100));
    text-decoration: none;
  }
  .outline .sub a {
    padding-left: 1.5rem;
  }
  .outline a:hover {
    color: var(--color-base-content);
  }
  .outline a[aria-current] {
    color: var(--color-base-content);
    border-left: 3px solid var(--color-primary);
    padding-left: calc(0.75rem - 2px);
  }
  .outline .sub a[aria-current] {
    padding-left: calc(1.5rem - 2px);
  }
}

.foot {
  margin-top: auto;
  padding: 1.5rem 1rem;
  border-top: 1px solid var(--color-base-300);
  font-size: 0.8125rem;
  text-align: center;
  color: color-mix(in srgb, var(--color-base-content) 75%, var(--color-base-100));
}
.foot p {
  margin: 0.2rem 0;
}
</style>
