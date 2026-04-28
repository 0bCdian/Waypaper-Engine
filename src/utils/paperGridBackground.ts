import type { CSSProperties } from "react";

/**
 * Graph-paper background matching {@link StartupIntro}: 24px grid on base-content.
 */
export function paperGridBackgroundStyle(options?: {
  /** Soft radial wash like the boot screen */
  vignette?: boolean;
  /** Grid line alpha (startup overlay uses ~0.07 before layer opacity) */
  lineAlpha?: number;
}): CSSProperties {
  const { vignette = true, lineAlpha = 0.07 } = options ?? {};
  const line = `oklch(from var(--color-base-content) l c h / ${lineAlpha})`;
  const gridLayers = [
    `linear-gradient(90deg, ${line} 1px, transparent 1px)`,
    `linear-gradient(${line} 1px, transparent 1px)`,
  ];

  if (!vignette) {
    return {
      backgroundImage: gridLayers.join(", "),
      backgroundSize: "24px 24px",
    };
  }

  return {
    backgroundImage: [
      "radial-gradient(ellipse 80% 60% at 50% 40%, transparent 40%, oklch(from var(--color-base-content) l c h / 0.08) 100%)",
      ...gridLayers,
    ].join(", "),
    backgroundSize: "100% 100%, 24px 24px, 24px 24px",
    backgroundRepeat: "no-repeat, repeat, repeat",
  };
}
