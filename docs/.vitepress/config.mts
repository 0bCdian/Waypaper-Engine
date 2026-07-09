import { defineConfig } from "vitepress";

// GitHub project Pages: https://<user>.github.io/<repo>/
// Change if you use a custom domain or different repo name.
const base = process.env.VITEPRESS_BASE ?? "/Waypaper-Engine/";

export default defineConfig({
  title: "Waypaper Engine",
  description:
    "Wallpaper gallery, playlists, and pluggable setters for Wayland and X11 — Go daemon, Electron UI, HTTP over Unix socket.",
  lang: "en-US",
  base,
  cleanUrls: true,
  srcDir: ".",
  lastUpdated: true,
  head: [
    ["meta", { name: "theme-color", content: "#fdf6e3" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    [
      "link",
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    ],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap",
      },
    ],
  ],
  ignoreDeadLinks: false,
  themeConfig: {
    logo: "/logo.png",
    nav: [
      { text: "Home", link: "/" },
      { text: "Docs", link: "/guide/introduction" },
    ],
    sidebar: {
      "/": [],
      "/guide/": [
        {
          text: "Getting started",
          items: [
            { text: "Install & run", link: "/guide/install" },
            { text: "First 10 minutes", link: "/guide/first-run" },
            { text: "The app (UI)", link: "/guide/app" },
            { text: "FAQ & troubleshooting", link: "/guide/faq" },
          ],
        },
        {
          text: "Reference",
          items: [
            { text: "Glossary", link: "/guide/glossary" },
            { text: "Backends & dependencies", link: "/guide/backends" },
            { text: "Configuration (TOML)", link: "/guide/config" },
            { text: "Daemon & paths", link: "/guide/daemon" },
            { text: "Packaging (DESTDIR, ...)", link: "/guide/packaging" },
          ],
        },
      ],
      "/api/": [
        {
          text: "Control plane",
          items: [
            { text: "Overview", link: "/api/overview" },
            {
              text: "OpenAPI spec (GitHub)",
              link: "https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/docs/openapi.yaml",
            },
          ],
        },
        {
          text: "Integration",
          items: [
            { text: "Events & SSE", link: "/api/sse" },
            {
              text: "API contract (GitHub)",
              link: "https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/API_CONTRACT.md",
            },
          ],
        },
      ],
      "/dev/": [
        {
          text: "Hacking on Waypaper",
          items: [{ text: "Development guide", link: "/dev/development" }],
        },
      ],
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/0bCdian/Waypaper-Engine" },
      {
        icon: "linkedin",
        link: "https://www.linkedin.com/in/diegoparranava-backend-devops-engineer/",
      },
    ],
    footer: {
      message:
        "Released under the project license. Docs track tagged releases on GitHub Pages.",
      copyright: "Copyright © 0bCdian & contributors",
    },
    search: {
      provider: "local",
    },
    outline: "deep",
  },
  markdown: {
    lineNumbers: true,
  },
  vite: {
    vue: {
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === "rapi-doc",
        },
      },
    },
  },
});
