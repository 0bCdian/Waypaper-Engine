import { Fragment, h } from "vue";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import DocMediaLightbox from "./components/DocMediaLightbox.vue";
import OpenApiDoc from "./components/OpenApiDoc.vue";
import HomeFooter from "./components/HomeFooter.vue";
import TryItPanel from "./components/TryItPanel.vue";
import HeroLogoParallax from "./components/HeroLogoParallax.vue";
import "./custom.css";

const theme: Theme = {
  extends: DefaultTheme,
  // Slot our custom blocks into the default layout.
  //   home-hero-image   — parallax logo (replaces default VPImage hero slot)
  //   home-features-after — Try it panel under the feature grid
  //   layout-bottom       — global footer (home + doc pages)
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "home-hero-image": () => h(HeroLogoParallax),
      "home-features-after": () => h(TryItPanel),
      "layout-bottom": () => h(Fragment, null, [h(HomeFooter), h(DocMediaLightbox)]),
    }),
  enhanceApp({ app }) {
    app.component("OpenApiDoc", OpenApiDoc);
  },
};

export default theme;
