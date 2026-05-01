import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import OpenApiDoc from "./components/OpenApiDoc.vue";

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("OpenApiDoc", OpenApiDoc);
  },
};

export default theme;
