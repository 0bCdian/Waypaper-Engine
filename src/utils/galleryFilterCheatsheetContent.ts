/** One token prefix row for the gallery filter cheatsheet (copy stays aligned with filter behavior). */
export interface GalleryFilterCheatsheetCard {
  prefix: string;
  title: string;
  description: string;
  example: string;
  /** DaisyUI semantic token for default-mode badge background */
  badgeVariant: "primary" | "secondary" | "accent" | "info" | "success" | "warning";
}

export const GALLERY_FILTER_CHEATSHEET_CARDS: GalleryFilterCheatsheetCard[] = [
  {
    prefix: "tag:",
    title: "Image tags",
    description: "Match images that have this tag.",
    example: "tag:nature",
    badgeVariant: "secondary",
  },
  {
    prefix: "type:",
    title: "Asset type",
    description:
      "One of image, video, gif, web. Several type: chips combine with OR on the client; the API uses a single media_type when only one is set.",
    example: "type:video",
    badgeVariant: "primary",
  },
  {
    prefix: "ext:",
    title: "Extension",
    description: "File format (png, jpg, mp4, …) without a leading dot.",
    example: "ext:png",
    badgeVariant: "success",
  },
  {
    prefix: "color:",
    title: "Hex palette",
    description: "Exact match: stored dominant-color palette must include this hex (#rgb or #rrggbb).",
    example: "color:#aabbcc",
    badgeVariant: "accent",
  },
  {
    prefix: "near:",
    title: "Perceptual color",
    description:
      "Perceptual match: minimum CIE76 ΔE from the hex to any stored swatch must be ≤ the limit, e.g. near:#ff0000~12",
    example: "near:#ff0000~12",
    badgeVariant: "warning",
  },
  {
    prefix: "q:",
    title: "Text search",
    description: "Text search (name and tags) on the server.",
    example: "q:mountains",
    badgeVariant: "info",
  },
];
