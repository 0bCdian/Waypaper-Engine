import { fileURLToPath } from "node:url";
import { createCssVariablesTheme } from "shiki";
import { defineConfig } from "vitepress";
import { palettesPlugin } from "./palettes";

// GitHub project Pages: https://<user>.github.io/<repo>/
// Change if you use a custom domain or different repo name.
const base = process.env.VITEPRESS_BASE ?? "/Waypaper-Engine/";

// Runs before first paint so the saved palette never flashes. Keep in sync with ThemePicker.vue.
const themeScript = `(function(){var t;try{t=localStorage.getItem("wp-docs-theme")}catch(e){}if(!t)t=matchMedia("(prefers-color-scheme: light)").matches?"gruvbox-material-light":"gruvbox-material";document.documentElement.dataset.theme=t})()`;

export default defineConfig({
  title: "Waypaper Engine",
  description:
    "A wallpaper engine for Linux ricing: gallery, playlists and your pick of setters on Wayland and X11.",
  lang: "en-US",
  base,
  cleanUrls: true,
  srcDir: ".",
  lastUpdated: true,
  head: [
    ["meta", { name: "theme-color", content: "#282828" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
      },
    ],
    ["script", {}, themeScript],
  ],
  ignoreDeadLinks: false,
  themeConfig: {
    logo: "/logo.png",
    nav: [
      { text: "Manual", link: "/manual/install" },
      { text: "Reference", link: "/reference/cli" },
      { text: "Hacking", link: "/dev/development" },
    ],
    // One ordered chapter list for every page (omarchy-manual style).
    sidebar: [
      {
        text: "Manual",
        items: [
          { text: "01 Install", link: "/manual/install" },
          { text: "02 First run", link: "/manual/first-run" },
          { text: "03 Gallery", link: "/manual/gallery" },
          { text: "04 Playlists", link: "/manual/playlists" },
          { text: "05 Displays & monitors", link: "/manual/displays" },
          { text: "06 Backends", link: "/manual/backends" },
          { text: "07 HTML wallpapers", link: "/manual/html-wallpapers" },
          { text: "08 Parallax", link: "/manual/parallax" },
          { text: "09 Themes & fonts", link: "/manual/themes" },
          { text: "10 Wallhaven", link: "/manual/wallhaven" },
          { text: "11 Studios", link: "/manual/studios" },
          { text: "12 Scripting & hooks", link: "/manual/scripting" },
          { text: "13 Troubleshooting", link: "/manual/troubleshooting" },
          { text: "Changelog", link: "/manual/changelog" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "CLI", link: "/reference/cli" },
          { text: "config.toml", link: "/reference/config" },
          { text: "HTTP API", link: "/reference/api" },
          { text: "Events (SSE)", link: "/reference/events" },
          { text: "Paths & files", link: "/reference/paths" },
          { text: "Glossary", link: "/reference/glossary" },
        ],
      },
      {
        text: "Hacking",
        items: [
          { text: "Development", link: "/dev/development" },
          { text: "Adding a backend", link: "/dev/backends" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/0bCdian/Waypaper-Engine" },
      {
        icon: "linkedin",
        link: "https://www.linkedin.com/in/diegoparranava-backend-devops-engineer/",
      },
    ],
    footer: {
      message: "GPL-3.0 · © 0bCdian & contributors",
    },
    search: {
      provider: "local",
    },
    outline: "deep",
  },
  appearance: false,
  markdown: {
    // Token colours come from --shiki-* variables, mapped to the active palette in style.css.
    theme: createCssVariablesTheme({ name: "css-variables", variablePrefix: "--shiki-" }),
  },
  vite: {
    plugins: [palettesPlugin(fileURLToPath(new URL("../../src/styles/themes", import.meta.url)))],
  },
});
