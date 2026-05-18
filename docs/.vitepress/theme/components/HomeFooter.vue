<script setup lang="ts">
import { useData } from "vitepress";
const { theme } = useData();
</script>

<template>
  <footer v-if="theme.footer" class="home-footer">
    <div class="home-footer__inner">
      <p v-if="theme.footer.message" class="home-footer__message">
        {{ theme.footer.message }}
      </p>
      <p v-if="theme.footer.copyright" class="home-footer__copyright">
        {{ theme.footer.copyright }}
      </p>
    </div>
  </footer>
</template>

<style scoped>
.home-footer {
  position: relative;
  z-index: 1;
  /* Block the full-page drafting grid (Layout pseudos); keeps legal line readable */
  background-color: var(--vp-c-bg);
  border-top: 1px solid var(--vp-c-divider);
  padding: 1.25rem 1.5rem;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.home-footer__inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  max-width: 1152px;
  margin: 0 auto;
}

.home-footer__message,
.home-footer__copyright {
  margin: 0;
}

@media (max-width: 640px) {
  .home-footer__inner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
