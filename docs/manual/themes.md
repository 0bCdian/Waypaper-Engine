# Themes & fonts

Pick a colour palette and font preset in **Settings → General → Theme & Appearance** (and **Typography**). They apply instantly.

## Pick a theme

1. Open **Settings → General → Theme & Appearance**.
2. Expand **Application Theme**.
3. Filter with the search box or **All / Light / Dark**, then click a pill.

The default is **Kolision Raw** (light) or **Kolision Raw Dark**, following your system on first launch. Set it in `config.toml`, or from the CLI ([Config](/reference/config)). The value is the palette's lowercase-with-dashes name, like `catppuccin-mocha`.

```toml
[app]
theme = "gruvbox-material"
```

```bash
waypaper-daemon config set app '{"theme":"nord"}'
```

## Palettes

| Dark | Light |
| --- | --- |
| 80s Vibe | 80s Vibe Light |
| Catppuccin Mocha | Catppuccin Latte |
| Everforest | Everforest Light |
| Gruvbox | Gruvbox Light |
| Gruvbox Material | Gruvbox Material Light |
| Kanagawa | Kanagawa Light |
| Kolision Raw Dark | Kolision Raw |
| Monokai | Monokai Light |
| Nord | Nord Light |
| Solarized | Solarized Light |
| Tokyo Night | Tokyo Day |
| | Dracula Light |

The picker also lists DaisyUI's stock themes (Light, Dark, Cupcake, Bumblebee, Emerald, Synthwave, Retro, Halloween, Forest, Lo-fi, Pastel, Wireframe, Black, Dracula, CMYK, Autumn, Business, Acid, Lemonade, Night, Dim). The palettes above win on name clashes.

## Fonts

**Settings → General → Typography** has four presets:

| Preset (`font_preset`) | You get |
| --- | --- |
| Shipped (Kolision) (`bundled`, default) | Inter for text, Space Grotesk for headings, JetBrains Mono for code |
| Google Sans (`google_sans`) | Google Sans Flex for text and headings, JetBrains Mono for code |
| Follow system (`system`) | Your OS UI fonts and a system monospace |
| Custom (`custom`) | Your own CSS `font-family` stacks for body, display and mono |

For Custom, use installed font names. An empty field keeps the shipped font for that role. Stacks can't contain `;`, `{` or `}` and are cut at 400 characters.

```toml
[app]
font_preset = "custom"
font_family_body = "\"Fira Sans\", sans-serif"
font_family_display = "\"Fira Sans\", sans-serif"
font_family_mono = "\"Fira Code\", monospace"
```

## Your own themes

::: warning Not working yet
User themes in `~/.config/waypaper-engine/themes/` don't load or switch in packaged builds yet.
:::
