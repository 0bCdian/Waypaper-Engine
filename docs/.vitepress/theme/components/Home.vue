<script setup lang="ts">
import { withBase } from "vitepress";
import InstallCommand from "./InstallCommand.vue";

const features = [
  [
    "Gallery",
    "gallery",
    "Images, videos and HTML wallpapers with thumbnails, tags, colour search and Wallhaven built in.",
  ],
  [
    "Playlists",
    "playlists",
    "Timer, manual, time-of-day and day-of-week rotation, run by the daemon.",
  ],
  [
    "Backends",
    "backends",
    "awww, hyprpaper, swaybg, feh, mpvpaper or wal-qt. Auto mode picks one per media type.",
  ],
  ["HTML wallpapers", "html-wallpapers", "Web pages as wallpapers on Wayland, rendered by wal-qt."],
  ["Parallax", "parallax", "The wallpaper shifts as you switch workspaces on Hyprland and Sway."],
  [
    "Scripting / API",
    "scripting",
    "The same JSON API the UI uses, plus an SSE event stream and hook scripts.",
  ],
];
</script>

<template>
  <div class="home">
    <section class="hero">
      <div class="hero__text">
        <h1 class="hero__name">Waypaper Engine</h1>
        <p class="hero__tag">
          A wallpaper engine built for ricing. Gallery, playlists and your pick of setters, on
          Wayland and X11.
        </p>
        <InstallCommand />
        <p class="hero__links links">
          <a :href="withBase('/manual/install')">Install guide</a>
          <a :href="withBase('/manual/first-run')">First run</a>
        </p>
      </div>
      <figure class="frame">
        <div class="frame__bar" aria-hidden="true"><span /><span /><span /></div>
        <video
          class="frame__video"
          :src="withBase('/media/hero.webm')"
          :poster="withBase('/media/hero-poster.webp')"
          autoplay
          muted
          loop
          playsinline
          preload="metadata"
          data-no-lightbox
          aria-label="Waypaper Engine browsing a wallpaper gallery"
        />
        <img
          class="frame__poster"
          :src="withBase('/media/hero-poster.webp')"
          alt="Waypaper Engine browsing a wallpaper gallery"
        />
      </figure>
    </section>

    <section class="features" aria-label="Features">
      <a
        v-for="[title, slug, text] in features"
        :key="slug"
        class="feature"
        :href="withBase(`/manual/${slug}`)"
      >
        <h2>{{ title }}</h2>
        <p>{{ text }}</p>
      </a>
    </section>

  </div>
</template>

<style scoped>
.home {
  width: 100%;
  max-width: 76rem;
  margin: 0 auto;
  padding: 3rem 1rem 4rem;
}
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2.5rem;
  align-items: center;
}
@media (min-width: 960px) {
  .hero {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 3.5rem;
  }
}
.hero__name {
  margin: 0 0 1rem;
  font-family: var(--font-display);
  font-size: clamp(2.6rem, 9vw, 4.75rem);
  font-weight: 800;
  line-height: 0.98;
  letter-spacing: -0.04em;
  border: 0;
}
.hero__tag {
  margin: 0 0 1.75rem;
  max-width: 34ch;
  font-size: 1.0625rem;
  line-height: 1.6;
}
.hero__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin: 1.25rem 0 0;
  font-size: 0.875rem;
}

/* the one memorable object: a square window around the app video */
.frame {
  margin: 0;
  border: 1px solid var(--color-base-300);
  background: var(--color-base-200);
  box-shadow: 0.5rem 0.5rem 0 var(--color-base-300);
}
.frame__bar {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem 0.7rem;
  border-bottom: 1px solid var(--color-base-300);
}
.frame__bar span {
  width: 0.55rem;
  height: 0.55rem;
  border: 1px solid var(--color-base-content);
  opacity: 0.5;
}
.frame__video,
.frame__poster {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}
.frame__poster {
  display: none;
}
@media (prefers-reduced-motion: reduce) {
  .frame__video {
    display: none;
  }
  .frame__poster {
    display: block;
  }
}

.features {
  display: grid;
  margin-top: 4.5rem;
  border-top: 1px solid var(--color-base-300);
  border-left: 1px solid var(--color-base-300);
}
@media (min-width: 640px) {
  .features {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 960px) {
  .features {
    grid-template-columns: repeat(3, 1fr);
  }
}
.feature {
  padding: 1.25rem 1.25rem 1.5rem;
  border-right: 1px solid var(--color-base-300);
  border-bottom: 1px solid var(--color-base-300);
  color: inherit;
  text-decoration: none;
}
.feature h2 {
  margin: 0 0 0.5rem;
  padding: 0;
  border: 0;
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.feature p {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: color-mix(in srgb, var(--color-base-content) 78%, var(--color-base-100));
}
.feature:hover,
.feature:focus-visible {
  background: var(--color-base-200);
}
.feature:hover h2 {
  color: var(--color-primary);
}

</style>
