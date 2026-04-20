import type { AppConfig } from "../../electron/daemon-go-types";
import {
  BUNDLED_FONT_BODY,
  BUNDLED_FONT_DISPLAY,
  BUNDLED_FONT_MONO,
  GOOGLE_SANS_FONT_MONO,
  GOOGLE_SANS_FONT_UI,
  SYSTEM_FONT_BODY,
  SYSTEM_FONT_DISPLAY,
  SYSTEM_FONT_MONO,
} from "./typographyStacks";

export const FONT_PRESET_VALUES = ["bundled", "google_sans", "system", "custom"] as const;
export type FontPreset = (typeof FONT_PRESET_VALUES)[number];

const CSS_VAR_BODY = "--font-body";
const CSS_VAR_DISPLAY = "--font-display";
const CSS_VAR_MONO = "--font-mono";

const MAX_FONT_STACK_LEN = 400;

export function normalizeFontPreset(raw: string | undefined | null): FontPreset {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "" || s === "bundled") return "bundled";
  if (FONT_PRESET_VALUES.includes(s as FontPreset)) return s as FontPreset;
  return "bundled";
}

/**
 * Sanitize a user-supplied font-family fragment for use in style.setProperty.
 * Returns null if empty or invalid after sanitization.
 */
function stripAsciiControls(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c >= 0x20 && c !== 0x7f) out += raw[i]!;
  }
  return out;
}

export function sanitizeFontStack(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = stripAsciiControls(raw).trim();
  if (s.length > MAX_FONT_STACK_LEN) s = s.slice(0, MAX_FONT_STACK_LEN);
  if (s === "") return null;
  if (/[;{}]/.test(s)) return null;
  return s;
}

type AppFontSlice = Pick<
  AppConfig,
  "font_preset" | "font_family_body" | "font_family_display" | "font_family_mono"
>;

export function applyAppTypography(app: AppFontSlice | null | undefined): void {
  const root = document.documentElement;
  const preset = normalizeFontPreset(app?.font_preset);

  if (preset === "bundled") {
    root.style.removeProperty(CSS_VAR_BODY);
    root.style.removeProperty(CSS_VAR_DISPLAY);
    root.style.removeProperty(CSS_VAR_MONO);
    return;
  }

  if (preset === "google_sans") {
    root.style.setProperty(CSS_VAR_BODY, GOOGLE_SANS_FONT_UI);
    root.style.setProperty(CSS_VAR_DISPLAY, GOOGLE_SANS_FONT_UI);
    root.style.setProperty(CSS_VAR_MONO, GOOGLE_SANS_FONT_MONO);
    return;
  }

  if (preset === "system") {
    root.style.setProperty(CSS_VAR_BODY, SYSTEM_FONT_BODY);
    root.style.setProperty(CSS_VAR_DISPLAY, SYSTEM_FONT_DISPLAY);
    root.style.setProperty(CSS_VAR_MONO, SYSTEM_FONT_MONO);
    return;
  }

  const body = sanitizeFontStack(app?.font_family_body);
  const display = sanitizeFontStack(app?.font_family_display);
  const mono = sanitizeFontStack(app?.font_family_mono);

  if (body) root.style.setProperty(CSS_VAR_BODY, body);
  else root.style.removeProperty(CSS_VAR_BODY);

  if (display) root.style.setProperty(CSS_VAR_DISPLAY, display);
  else root.style.removeProperty(CSS_VAR_DISPLAY);

  if (mono) root.style.setProperty(CSS_VAR_MONO, mono);
  else root.style.removeProperty(CSS_VAR_MONO);
}

/** For tests: expected resolved stacks when not using stylesheet fallbacks */
export function resolvedStacksForPreset(
  preset: FontPreset,
  custom?: Partial<Pick<AppConfig, "font_family_body" | "font_family_display" | "font_family_mono">>,
): { body: string; display: string; mono: string } {
  if (preset === "bundled") {
    return {
      body: BUNDLED_FONT_BODY,
      display: BUNDLED_FONT_DISPLAY,
      mono: BUNDLED_FONT_MONO,
    };
  }
  if (preset === "google_sans") {
    return { body: GOOGLE_SANS_FONT_UI, display: GOOGLE_SANS_FONT_UI, mono: GOOGLE_SANS_FONT_MONO };
  }
  if (preset === "system") {
    return {
      body: SYSTEM_FONT_BODY,
      display: SYSTEM_FONT_DISPLAY,
      mono: SYSTEM_FONT_MONO,
    };
  }
  return {
    body: sanitizeFontStack(custom?.font_family_body) ?? BUNDLED_FONT_BODY,
    display: sanitizeFontStack(custom?.font_family_display) ?? BUNDLED_FONT_DISPLAY,
    mono: sanitizeFontStack(custom?.font_family_mono) ?? BUNDLED_FONT_MONO,
  };
}
