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
	head: [["meta", { name: "theme-color", content: "#1c1917" }]],
	ignoreDeadLinks: true,
	themeConfig: {
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Guide", link: "/guide/introduction" },
			{ text: "API", link: "/api/overview" },
			{ text: "OpenAPI spec", link: "/api/openapi" },
			{ text: "Hacking", link: "/dev/development" },
		],
		sidebar: {
			"/": [
				{ text: "Welcome", link: "/" },
				{ text: "Why v3", link: "/guide/whats-new" },
			],
			"/guide/": [
				{
					text: "Getting started",
					items: [
						{ text: "Introduction", link: "/guide/introduction" },
						{ text: "Install & run", link: "/guide/install" },
						{ text: "The app (UI)", link: "/guide/app" },
					],
				},
				{
					text: "Reference",
					items: [
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
						{ text: "OpenAPI spec & curl examples", link: "/api/openapi" },
					],
				},
				{
					text: "Integration",
					items: [
						{ text: "Events & SSE", link: "/api/sse" },
						{ text: "Authoritative reference", link: "/api/contract" },
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
		],
		footer: {
			message: "Released under the project license. Docs track tagged releases on GitHub Pages.",
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
