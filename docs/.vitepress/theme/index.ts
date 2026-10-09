import type { Theme } from "vitepress";
import Layout from "./Layout.vue";
import { setupVimNavigation } from "./vimNavigation";
import "vitepress/dist/client/theme-default/styles/icons.css"; // .vpi-* icons used by the search box
import "virtual:wp-palettes.css";
import "./style.css";

const theme: Theme = {
  Layout,
  enhanceApp() {
    if (typeof window !== "undefined") setupVimNavigation();
  },
};

export default theme;
