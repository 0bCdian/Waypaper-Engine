import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { HexColorPicker } from "react-colorful";
import { useImageDetailStore } from "../stores/imageDetailStore";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { useToastStore } from "../stores/toastStore";
import { useIsNeo } from "../hooks/useIsNeo";
import { webPreviewPlaybackKind } from "../utils/webPreviewPlayback";
import { playMutedVideoWhenReady } from "../utils/videoPreview";
import type {
  Image as DaemonImage,
  WaylandUtauriConfig,
  WebCapabilities,
  WebWallpaperConfigProp,
} from "../../electron/daemon-go-types";
import type { UnifiedConfig } from "@/shared/types/unifiedConfig";
import { useSettingsStore } from "@/stores/settingsStore";
import { daemonClient } from "@/client";

function waylandUtauriFromUnified(config: UnifiedConfig | null): WaylandUtauriConfig | null {
  if (!config?.backend || config.backend.type !== "wayland-utauri") return null;
  const b = config.backend as unknown as Record<string, unknown>;
  const w = b["wayland-utauri"] ?? b.waylandutauri;
  if (!w || typeof w !== "object") return null;
  return w as WaylandUtauriConfig;
}

/** Outbound HTML network needs global allow plus manifest `network`; other caps follow manifest only. */
function webCapabilityToggleAllowed(
  key: keyof WebCapabilities,
  wut: WaylandUtauriConfig | null,
): boolean {
  if (key !== "network") return true;
  if (wut == null) return true;
  return wut.allow_network_wallpapers === true;
}

const MAX_PALETTE_COLORS = 12;

async function saveImageDetails(imageId: number, tags: string[], colors: string[]) {
  await daemonClient.updateImage(imageId, { tags, colors });
  const freshImage = await daemonClient.getImage(imageId);
  useImageDetailStore.getState().open(freshImage);
  useImagesStore.getState().reQueryImages();
}

async function trySaveImageDetails(
  imageId: number,
  tags: string[],
  colors: string[],
): Promise<boolean> {
  try {
    await saveImageDetails(imageId, tags, colors);
    return true;
  } catch {
    return false;
  }
}

async function performImageRename(imageId: number, newName: string) {
  const updated = await useImagesStore.getState().renameImage(imageId, newName);
  useImageDetailStore
    .getState()
    .open(updated as unknown as import("../../electron/daemon-go-types").Image);
  return updated;
}

async function tryPerformImageRename(
  imageId: number,
  newName: string,
): Promise<{ name: string } | null> {
  try {
    return await performImageRename(imageId, newName);
  } catch {
    return null;
  }
}

type WebManifestUpdate = {
  wallpaper_config_overrides?: Record<string, unknown>;
  web_capabilities?: Partial<import("../../electron/daemon-go-types").WebCapabilities>;
};

async function tryUpdateWebManifest(
  imageId: number,
  update: WebManifestUpdate,
): Promise<import("../../electron/daemon-go-types").Image | null> {
  try {
    return await daemonClient.updateImage(imageId, update);
  } catch {
    return null;
  }
}

async function tryCopyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function colorPickerValue(hex: string): string {
  const s = String(hex ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1]!;
    const g = s[2]!;
    const b = s[3]!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#000000";
}

const PALETTE_POPOVER_PANEL_WIDTH = 300;
const PALETTE_POPOVER_EST_HEIGHT = 468;
const PALETTE_POPOVER_VIEW_MARGIN = 12;

function clampPalettePopoverPosition(anchor: DOMRect): { left: number; top: number } {
  const gap = 10;
  let left = anchor.left + anchor.width / 2 - PALETTE_POPOVER_PANEL_WIDTH / 2;
  let top = anchor.top - PALETTE_POPOVER_EST_HEIGHT - gap;

  left = Math.max(
    PALETTE_POPOVER_VIEW_MARGIN,
    Math.min(left, window.innerWidth - PALETTE_POPOVER_PANEL_WIDTH - PALETTE_POPOVER_VIEW_MARGIN),
  );

  if (top < PALETTE_POPOVER_VIEW_MARGIN) {
    top = anchor.bottom + gap;
  }
  top = Math.max(
    PALETTE_POPOVER_VIEW_MARGIN,
    Math.min(
      top,
      window.innerHeight - PALETTE_POPOVER_EST_HEIGHT - PALETTE_POPOVER_VIEW_MARGIN,
    ),
  );

  return { left, top };
}

type PalettePopoverState =
  | { mode: "add"; draftHex: string }
  | { mode: "replace"; index: number; draftHex: string };

/** Lowercase `#rgb` or `#rrggbb`, or null if invalid */
function canonicalHex(s: string): string | null {
  const t = String(s).trim();
  if (/^#[0-9a-fA-F]{6}$/i.test(t)) return t.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/i.test(t)) {
    const r = t[1]!;
    const g = t[2]!;
    const b = t[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

function hexToRgbTuple(hex: string): [number, number, number] | null {
  const c = canonicalHex(hex);
  if (!c) return null;
  return [
    Number.parseInt(c.slice(1, 3), 16),
    Number.parseInt(c.slice(3, 5), 16),
    Number.parseInt(c.slice(5, 7), 16),
  ];
}

function rgbTupleToHex(r: number, g: number, b: number): string {
  const clampCh = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const x = (n: number) => clampCh(n).toString(16).padStart(2, "0");
  return `#${x(r)}${x(g)}${x(b)}`;
}

function rgb255ToHsl(
  r255: number,
  g255: number,
  b255: number,
): { h: number; s: number; l: number } {
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d >= 1e-10) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToRgb255(h: number, s: number, light: number): [number, number, number] {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, light)) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) [rp, gp, bp] = [c, x, 0];
  else if (hh < 120) [rp, gp, bp] = [x, c, 0];
  else if (hh < 180) [rp, gp, bp] = [0, c, x];
  else if (hh < 240) [rp, gp, bp] = [0, x, c];
  else if (hh < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [
    Math.round((rp + m) * 255),
    Math.round((gp + m) * 255),
    Math.round((bp + m) * 255),
  ];
}

/** Stable ordered dedupe; skips blanks and invalid tokens */
function normalizedPalette(colors: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of colors) {
    const c = canonicalHex(raw.trim());
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

function palettesEqual(a: string[], b: string[]): boolean {
  const na = normalizedPalette(a);
  const nb = normalizedPalette(b);
  if (na.length !== nb.length) return false;
  return na.every((c, i) => c === nb[i]);
}

/** CSS-safe fill for invalid legacy palette tokens */
function swatchCssFill(hexRaw: string): string {
  return canonicalHex(hexRaw.trim()) ?? "#737373";
}

function normalizeWebCaps(c?: WebCapabilities | null): WebCapabilities {
  return {
    network: Boolean(c?.network),
    keyboard: Boolean(c?.keyboard),
    audio_reactive: Boolean(c?.audio_reactive),
    parallax_aware: Boolean(c?.parallax_aware),
    pointer_interactive: Boolean(c?.pointer_interactive),
  };
}

const WEB_CAP_KEYS: (keyof WebCapabilities)[] = [
  "network",
  "keyboard",
  "audio_reactive",
  "parallax_aware",
  "pointer_interactive",
];

const WEB_CAP_LABELS: Record<keyof WebCapabilities, string> = {
  network: "Network (fetch, WebSocket, …)",
  keyboard: "Keyboard input",
  audio_reactive: "Audio reactive",
  parallax_aware: "Parallax (tilt / workspace)",
  pointer_interactive: "Pointer interactive (hit-testing)",
};

function WebWallpaperConfigForm({
  image,
  onUpdated,
}: {
  image: DaemonImage;
  onUpdated: (img: DaemonImage) => void;
}) {
  const addToast = useToastStore((s) => s.addToast);
  const unifiedConfig = useSettingsStore((s) => s.config);
  const wutCfg = useMemo(() => waylandUtauriFromUnified(unifiedConfig), [unifiedConfig]);
  const meta = image.web_meta;
  const schema = meta?.wallpaper_config;
  const keys = schema ? Object.keys(schema) : [];
  const hasSchema = keys.length > 0;

  const serverOverridesKey = useMemo(
    () => JSON.stringify(image.wallpaper_config_overrides ?? {}),
    [image.wallpaper_config_overrides],
  );

  const serverCapsKey = useMemo(
    () => JSON.stringify(normalizeWebCaps(meta?.capabilities)),
    [image.id, meta?.capabilities],
  );

  const [overrides, setOverrides] = useState<Record<string, unknown>>(() => ({
    ...image.wallpaper_config_overrides,
  }));
  const [caps, setCaps] = useState<WebCapabilities>(() => normalizeWebCaps(meta?.capabilities));
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const overridesRef = useRef(overrides);
  useEffect(() => {
    overridesRef.current = overrides;
  });
  const capsRef = useRef(caps);
  useEffect(() => {
    capsRef.current = caps;
  });

  const [prevOverridesKey, setPrevOverridesKey] = useState(serverOverridesKey);
  const [prevCapsKey, setPrevCapsKey] = useState(serverCapsKey);

  if (serverOverridesKey !== prevOverridesKey) {
    setPrevOverridesKey(serverOverridesKey);
    setOverrides({ ...image.wallpaper_config_overrides });
    setSaveError(false);
  }
  if (serverCapsKey !== prevCapsKey) {
    setPrevCapsKey(serverCapsKey);
    setCaps(normalizeWebCaps(image.web_meta?.capabilities));
    setSaveError(false);
  }

  const dirtyOverrides = useMemo(
    () => JSON.stringify(overrides) !== serverOverridesKey,
    [overrides, serverOverridesKey],
  );

  const dirtyCaps = useMemo(() => JSON.stringify(caps) !== serverCapsKey, [caps, serverCapsKey]);

  const dirty = dirtyOverrides || dirtyCaps;

  const patchOverride = useCallback((key: string, value: unknown) => {
    setOverrides((o) => {
      const next = { ...o, [key]: value };
      overridesRef.current = next;
      return next;
    });
  }, []);

  const patchCap = useCallback((key: keyof WebCapabilities, value: boolean) => {
    setCaps((c) => {
      const next = { ...c, [key]: value };
      capsRef.current = next;
      return next;
    });
  }, []);

  const saveWebManifest = async () => {
    if (!dirtyOverrides && !dirtyCaps) return;
    setBusy(true);
    setSaveError(false);
    const update: WebManifestUpdate = {};
    if (dirtyOverrides) update.wallpaper_config_overrides = overridesRef.current;
    if (dirtyCaps) update.web_capabilities = capsRef.current;
    const updated = await tryUpdateWebManifest(image.id, update);
    if (updated) {
      onUpdated(updated);
      addToast("Web wallpaper saved", "success");
    } else {
      setSaveError(true);
      addToast("Failed to save web wallpaper", "error");
    }
    setBusy(false);
  };

  const defaultOverrides = useMemo(() => {
    const d: Record<string, unknown> = {};
    if (!schema) return d;
    for (const k of Object.keys(schema)) {
      const prop = schema[k] as WebWallpaperConfigProp;
      d[k] = prop.default;
    }
    return d;
  }, [schema]);

  const resetOverridesToDefaults = () => {
    setOverrides({ ...defaultOverrides });
    overridesRef.current = { ...defaultOverrides };
  };

  if (!meta) return null;

  return (
    <div className="space-y-3 border-t border-base-300 pt-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
        Web wallpaper
      </h4>
      <p className="text-xs text-base-content/50">
        Saves to <code className="text-[10px]">waypaper.json</code> on disk when you click Save.
        Merged values are pushed to the desktop as{" "}
        <code className="text-[10px]">waypaper:config</code> (capabilities update the host
        immediately after save).
      </p>

      <div className="space-y-2">
        <h5 className="text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
          Capabilities
        </h5>
        {wutCfg && wutCfg.allow_network_wallpapers !== true && (
          <p className="text-[11px] text-base-content/50">
            Turn on &quot;Allow network for HTML wallpapers&quot; in Backend → wayland-utauri to
            enable outbound fetch/XHR/WebSocket (manifest{" "}
            <code className="text-[10px]">network</code> must still be on).
          </p>
        )}
        <div className="flex flex-col gap-2">
          {WEB_CAP_KEYS.map((key) => {
            const policyAllows = webCapabilityToggleAllowed(key, wutCfg);
            const on = Boolean(caps[key]);
            const disabled = !policyAllows && !on;
            return (
              <label key={key} className="flex flex-col gap-0.5 text-xs">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    disabled={disabled}
                    checked={on}
                    onChange={(e) => patchCap(key, e.target.checked)}
                  />
                  <span>{WEB_CAP_LABELS[key]}</span>
                </span>
                {!policyAllows && key === "network" && (
                  <span className="pl-8 text-[10px] text-base-content/45">
                    Enable global HTML network in Settings → Backend → wayland-utauri to turn this
                    on.
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {hasSchema ? (
        <>
          <h5 className="text-[11px] font-semibold uppercase tracking-wide text-base-content/50 pt-1">
            Wallpaper settings
          </h5>
          <div className="flex flex-col gap-3">
            {keys.map((key) => {
              const prop = schema![key] as WebWallpaperConfigProp;
              const raw = overrides[key];
              const val = raw !== undefined ? raw : prop.default;
              const label = prop.label ?? key;
              const t = (prop.type ?? "").toLowerCase();
              if (t === "bool" || t === "boolean") {
                return (
                  <label key={key} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm"
                      checked={Boolean(val)}
                      onChange={(e) => patchOverride(key, e.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                );
              }
              if (t === "number") {
                const n = typeof val === "number" ? val : Number(val);
                return (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-semibold text-base-content/60">{label}</label>
                    <input
                      type="number"
                      className="input input-bordered input-sm w-full"
                      min={prop.min}
                      max={prop.max}
                      step={prop.step}
                      value={Number.isFinite(n) ? n : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        patchOverride(key, v === "" ? prop.default : Number(v));
                      }}
                    />
                  </div>
                );
              }
              if (t === "color") {
                const sval = typeof val === "string" ? val : String(val ?? "");
                return (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-semibold text-base-content/60">{label}</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="color"
                        aria-label={`${label} picker`}
                        className="h-9 w-14 cursor-pointer rounded border border-base-300 bg-base-100 p-0"
                        value={colorPickerValue(sval)}
                        onChange={(e) => patchOverride(key, e.target.value)}
                      />
                      <input
                        type="text"
                        className="input input-bordered input-sm min-w-[8rem] flex-1 font-mono text-xs"
                        value={sval}
                        onChange={(e) => patchOverride(key, e.target.value)}
                      />
                    </div>
                  </div>
                );
              }
              return (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-semibold text-base-content/60">{label}</label>
                  <input
                    type="text"
                    className="input input-bordered input-sm w-full"
                    value={typeof val === "string" ? val : val != null ? String(val) : ""}
                    onChange={(e) => patchOverride(key, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-xs text-base-content/40">
          No <code className="text-[10px]">wallpaper_config</code> in this package — only
          capabilities can be edited here.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {hasSchema && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={resetOverridesToDefaults}>
            Reset settings to defaults
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy || !dirty}
          onClick={() => void saveWebManifest()}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saveError && <span className="text-[10px] text-error">Save failed — check toast</span>}
      </div>
    </div>
  );
}

function DetailHoverVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const cancelPlayRef = useRef<(() => void) | null>(null);
  return (
    <div
      className="w-full"
      onPointerEnter={() => {
        cancelPlayRef.current?.();
        const v = ref.current;
        if (v) cancelPlayRef.current = playMutedVideoWhenReady(v);
      }}
      onPointerLeave={() => {
        cancelPlayRef.current?.();
        cancelPlayRef.current = null;
        const v = ref.current;
        if (v) {
          v.pause();
          v.currentTime = 0;
        }
      }}
    >
      <video
        ref={ref}
        src={src}
        poster={poster}
        className="w-full rounded-lg object-cover"
        muted
        loop
        playsInline
        preload="auto"
        onEnded={(e) => {
          const v = e.currentTarget;
          v.currentTime = 0;
          void v.play().catch(() => {});
        }}
      />
    </div>
  );
}

function PalettePopoverColorFields({
  draftHex,
  onPickHex,
  isNeo,
}: {
  draftHex: string;
  onPickHex: (hex: string) => void;
  isNeo: boolean;
}) {
  const canonicalDraft = useMemo(() => canonicalHex(draftHex) ?? "#000000", [draftHex]);

  const hexFocusedRef = useRef(false);
  const rgbWrapFocusedRef = useRef(false);
  const hslWrapFocusedRef = useRef(false);

  const [hexField, setHexField] = useState(() => canonicalHex(draftHex) ?? "#000000");
  const [rField, setRField] = useState("0");
  const [gField, setGField] = useState("0");
  const [bField, setBField] = useState("0");
  const [hField, setHField] = useState("0");
  const [sField, setSField] = useState("0");
  const [lField, setLField] = useState("0");

  const syncAllFromHex = useCallback((hex: string) => {
    const c =
      canonicalHex(hex.trim()) ??
      canonicalHex(colorPickerValue(hex.trim())) ??
      "#000000";
    const t = hexToRgbTuple(c);
    setHexField(c);
    if (t) {
      const [r, g, b] = t;
      setRField(String(r));
      setGField(String(g));
      setBField(String(b));
      const hsl = rgb255ToHsl(r, g, b);
      setHField(String(hsl.h));
      setSField(String(hsl.s));
      setLField(String(hsl.l));
    }
  }, []);

  useLayoutEffect(() => {
    if (hexFocusedRef.current || rgbWrapFocusedRef.current || hslWrapFocusedRef.current) {
      return;
    }
    syncAllFromHex(draftHex);
  }, [draftHex, syncAllFromHex]);

  const pushValidHex = useCallback(
    (hex: string) => {
      const c = canonicalHex(hex);
      if (c) onPickHex(c);
    },
    [onPickHex],
  );

  const commitRgb = useCallback(() => {
    const r = Number.parseInt(rField, 10);
    const g = Number.parseInt(gField, 10);
    const b = Number.parseInt(bField, 10);
    if (
      Number.isFinite(r) &&
      Number.isFinite(g) &&
      Number.isFinite(b) &&
      r >= 0 &&
      r <= 255 &&
      g >= 0 &&
      g <= 255 &&
      b >= 0 &&
      b <= 255
    ) {
      const hex = rgbTupleToHex(r, g, b);
      pushValidHex(hex);
      syncAllFromHex(hex);
    } else {
      syncAllFromHex(canonicalDraft);
    }
  }, [rField, gField, bField, pushValidHex, syncAllFromHex, canonicalDraft]);

  const commitHsl = useCallback(() => {
    const h = Number.parseFloat(hField);
    const s = Number.parseFloat(sField);
    const l = Number.parseFloat(lField);
    if (
      Number.isFinite(h) &&
      Number.isFinite(s) &&
      Number.isFinite(l) &&
      s >= 0 &&
      s <= 100 &&
      l >= 0 &&
      l <= 100
    ) {
      const [r, g, b] = hslToRgb255(h, Math.round(s), Math.round(l));
      const hex = rgbTupleToHex(r, g, b);
      pushValidHex(hex);
      syncAllFromHex(hex);
    } else {
      syncAllFromHex(canonicalDraft);
    }
  }, [hField, sField, lField, pushValidHex, syncAllFromHex, canonicalDraft]);

  const inputCls = `input input-bordered input-xs min-w-0 w-full font-mono tabular-nums ${isNeo ? "rounded-none" : ""}`;
  const labelCls =
    "mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-base-content/55";

  return (
    <div className="mt-2 space-y-2 border-t border-base-content/10 pt-2">
      <div>
        <label className={labelCls} htmlFor="palette-popover-hex">
          Hex
        </label>
        <input
          id="palette-popover-hex"
          type="text"
          className={inputCls}
          value={hexField}
          spellCheck={false}
          autoComplete="off"
          onFocus={() => {
            hexFocusedRef.current = true;
          }}
          onBlur={() => {
            hexFocusedRef.current = false;
            const c = canonicalHex(hexField.trim());
            if (c) {
              pushValidHex(c);
              syncAllFromHex(c);
            } else {
              syncAllFromHex(canonicalDraft);
            }
          }}
          onChange={(e) => setHexField(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </div>

      <div
        onFocusCapture={() => {
          rgbWrapFocusedRef.current = true;
        }}
        onBlurCapture={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          rgbWrapFocusedRef.current = false;
          commitRgb();
        }}
      >
        <span className={labelCls}>RGB (0–255)</span>
        <div className="mt-1 grid grid-cols-3 gap-1">
          <input
            aria-label="Red 0–255"
            type="text"
            inputMode="numeric"
            className={inputCls}
            value={rField}
            onChange={(e) => setRField(e.target.value)}
          />
          <input
            aria-label="Green 0–255"
            type="text"
            inputMode="numeric"
            className={inputCls}
            value={gField}
            onChange={(e) => setGField(e.target.value)}
          />
          <input
            aria-label="Blue 0–255"
            type="text"
            inputMode="numeric"
            className={inputCls}
            value={bField}
            onChange={(e) => setBField(e.target.value)}
          />
        </div>
      </div>

      <div
        onFocusCapture={() => {
          hslWrapFocusedRef.current = true;
        }}
        onBlurCapture={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          hslWrapFocusedRef.current = false;
          commitHsl();
        }}
      >
        <span className={labelCls}>HSL (h° / s% / l%)</span>
        <div className="mt-1 grid grid-cols-3 gap-1">
          <input
            aria-label="Hue degrees"
            type="text"
            inputMode="decimal"
            className={inputCls}
            value={hField}
            onChange={(e) => setHField(e.target.value)}
          />
          <input
            aria-label="Saturation percent"
            type="text"
            inputMode="decimal"
            className={inputCls}
            value={sField}
            onChange={(e) => setSField(e.target.value)}
          />
          <input
            aria-label="Lightness percent"
            type="text"
            inputMode="decimal"
            className={inputCls}
            value={lField}
            onChange={(e) => setLField(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function PaletteSwatchChip({
  fill,
  isNeo,
  title,
  ariaLabelCopy,
  ariaLabelRemove,
  onCopy,
  onOpenColorPopover,
  onRemove,
}: {
  fill: string;
  isNeo: boolean;
  title: string;
  ariaLabelCopy: string;
  ariaLabelRemove: string;
  onCopy: () => void;
  onOpenColorPopover: () => void;
  onRemove: () => void;
}) {
  const copyDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyDelayRef.current) clearTimeout(copyDelayRef.current);
    },
    [],
  );

  const armCopy = useCallback(() => {
    if (copyDelayRef.current) clearTimeout(copyDelayRef.current);
    copyDelayRef.current = setTimeout(() => {
      copyDelayRef.current = null;
      onCopy();
    }, 230);
  }, [onCopy]);

  const cancelCopyArm = useCallback(() => {
    if (copyDelayRef.current) {
      clearTimeout(copyDelayRef.current);
      copyDelayRef.current = null;
    }
  }, []);

  return (
    <div className="group relative h-8 w-8 shrink-0 focus-within:z-[1]">
      <button
        type="button"
        className={`relative z-10 h-full w-full shrink-0 border shadow-sm transition-[transform,box-shadow,ring-color] hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-200 ${
          isNeo
            ? "rounded-none border-2 border-base-content/35 shadow-[3px_3px_0_0_color-mix(in_oklab,var(--fallback-bc,oklch(var(--bc))),18%),transparent)]"
            : "rounded-lg border-base-content/25"
        }`}
        style={{ backgroundColor: fill }}
        title={title}
        aria-label={ariaLabelCopy}
        onClick={armCopy}
        onDoubleClick={(e) => {
          e.preventDefault();
          cancelCopyArm();
          onOpenColorPopover();
        }}
      />
      <button
        type="button"
        className={`btn btn-ghost btn-square absolute -right-1.5 -top-1.5 min-h-0 h-5 w-5 border bg-base-100 p-0 text-xs leading-none opacity-0 shadow-sm transition-opacity hover:bg-error/15 hover:text-error group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          isNeo ? "rounded-none border-base-content/40" : "rounded-full border-base-300"
        }`}
        aria-label={ariaLabelRemove}
        title="Remove"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          cancelCopyArm();
          onRemove();
        }}
      >
        ×
      </button>
    </div>
  );
}

function ImageDetailSidebar() {
  const navigate = useNavigate();
  const { selectedImage, isOpen, close } = useImageDetailStore(
    useShallow((s) => ({
      selectedImage: s.selectedImage,
      isOpen: s.isOpen,
      close: s.close,
    })),
  );
  const addToast = useToastStore((s) => s.addToast);
  const copyPaletteColor = useCallback(
    async (hex: string) => {
      const ok = await tryCopyToClipboard(hex);
      if (ok) {
        const label = hex.length > 28 ? `${hex.slice(0, 28)}…` : hex;
        addToast(`Copied to clipboard: ${label}`, "success", 2500);
      } else {
        addToast("Could not copy color to clipboard", "error", 4000);
      }
    },
    [addToast],
  );
  const openDetailFromConfigForm = useCallback((img: DaemonImage) => {
    useImageDetailStore.getState().open(img);
  }, []);
  const isNeo = useIsNeo();
  const [tags, setTags] = useState<string[]>([]);
  const [editColors, setEditColors] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  /** First change appends one swatch; later changes update that index until the next add popover open. */
  const addPickerSessionRef = useRef<{ provisionalIndex: number | null }>({
    provisionalIndex: null,
  });

  const palettePopoverRef = useRef<PalettePopoverState | null>(null);
  const [palettePopover, setPalettePopover] = useState<PalettePopoverState | null>(null);
  const [palettePopoverPosition, setPalettePopoverPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const paletteRowAnchorRef = useRef<HTMLDivElement>(null);
  const imageDetailBodyScrollRef = useRef<HTMLDivElement>(null);

  palettePopoverRef.current = palettePopover;

  const resetAddPalettePickerSession = useCallback(() => {
    addPickerSessionRef.current = { provisionalIndex: null };
  }, []);

  const closePalettePopover = useCallback(() => {
    setPalettePopover(null);
    setPalettePopoverPosition(null);
  }, []);

  const measurePalettePopoverPosition = useCallback(() => {
    const el = paletteRowAnchorRef.current;
    if (!el) {
      return {
        left: PALETTE_POPOVER_VIEW_MARGIN,
        top: PALETTE_POPOVER_VIEW_MARGIN,
      };
    }
    return clampPalettePopoverPosition(el.getBoundingClientRect());
  }, []);

  const openPalettePopoverAdd = useCallback(() => {
    if (editColors.length >= MAX_PALETTE_COLORS) return;
    resetAddPalettePickerSession();
    setPalettePopoverPosition(measurePalettePopoverPosition());
    setPalettePopover({ mode: "add", draftHex: "#808080" });
  }, [editColors.length, resetAddPalettePickerSession, measurePalettePopoverPosition]);

  const openPalettePopoverReplace = useCallback(
    (index: number, rawHex: string) => {
      setPalettePopoverPosition(measurePalettePopoverPosition());
      setPalettePopover({
        mode: "replace",
        index,
        draftHex: colorPickerValue(rawHex),
      });
    },
    [measurePalettePopoverPosition],
  );

  const [prevSelectedImage, setPrevSelectedImage] = useState(selectedImage);
  if (selectedImage !== prevSelectedImage) {
    setPrevSelectedImage(selectedImage);
    if (selectedImage) {
      setTags([...(selectedImage.tags ?? [])]);
      setEditName(selectedImage.name);
      setEditColors([...(selectedImage.colors ?? [])]);
    }
  }

  useEffect(() => {
    if (isOpen) {
      void daemonClient
        .getImageTags()
        .then((resp) => {
          setAllTags(resp.tags ?? []);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    addPickerSessionRef.current = { provisionalIndex: null };
    closePalettePopover();
  }, [selectedImage?.id, closePalettePopover]);

  const suggestions = useMemo(() => {
    if (!tagInput.trim()) return [];
    const term = tagInput.toLowerCase();
    const tagSet = new Set(tags.map((t) => t.toLowerCase()));
    return allTags
      .filter((t) => t.toLowerCase().includes(term) && !tagSet.has(t.toLowerCase()))
      .slice(0, 8);
  }, [tagInput, allTags, tags]);

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (!trimmed) return;
      if (tags.some((t) => t.toLowerCase() === trimmed)) return;
      setTags((prev) => [...prev, trimmed]);
      setTagInput("");
      setShowSuggestions(false);
    },
    [tags],
  );

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addTag(tagInput);
      } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
        setTags((prev) => prev.slice(0, -1));
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    },
    [tagInput, tags, addTag],
  );

  const removePaletteColor = useCallback((index: number) => {
    setEditColors((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const applyAddPaletteColorHex = useCallback((hex: string) => {
    const canon = canonicalHex(hex);
    if (!canon) return;
    const session = addPickerSessionRef.current;

    setEditColors((prev) => {
      if (prev.length >= MAX_PALETTE_COLORS) return prev;

      if (session.provisionalIndex !== null) {
        const i = session.provisionalIndex;
        if (i >= 0 && i < prev.length) {
          const next = [...prev];
          next[i] = canon;
          return next;
        }
        session.provisionalIndex = null;
      }

      if (prev.some((p) => canonicalHex(p.trim()) === canon)) return prev;
      const next = [...prev, canon];
      session.provisionalIndex = next.length - 1;
      return next;
    });
  }, []);

  const replacePaletteColorAt = useCallback((index: number, hex: string) => {
    const canon = canonicalHex(hex);
    if (!canon) return;
    setEditColors((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next[index] = canon;
      return next;
    });
  }, []);

  const handlePopoverColorChange = useCallback(
    (hex: string) => {
      const canon = canonicalHex(hex);
      if (!canon) return;
      setPalettePopover((p) => (p ? { ...p, draftHex: canon } : p));
      const ctx = palettePopoverRef.current;
      if (!ctx) return;
      if (ctx.mode === "add") {
        applyAddPaletteColorHex(canon);
      } else {
        replacePaletteColorAt(ctx.index, canon);
      }
    },
    [applyAddPaletteColorHex, replacePaletteColorAt],
  );

  const palettePopoverLayoutKey =
    palettePopover === null
      ? null
      : palettePopover.mode === "add"
        ? "add"
        : `replace:${palettePopover.index}`;

  useLayoutEffect(() => {
    if (palettePopoverLayoutKey === null) {
      setPalettePopoverPosition(null);
      return;
    }
    const updatePosition = () => {
      const el = paletteRowAnchorRef.current;
      if (!el) return;
      setPalettePopoverPosition(clampPalettePopoverPosition(el.getBoundingClientRect()));
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    const scrollEl = imageDetailBodyScrollRef.current;
    scrollEl?.addEventListener("scroll", updatePosition, { passive: true });
    return () => {
      window.removeEventListener("resize", updatePosition);
      scrollEl?.removeEventListener("scroll", updatePosition);
    };
  }, [palettePopoverLayoutKey]);

  useEffect(() => {
    if (palettePopoverLayoutKey === null) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePalettePopover();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [palettePopoverLayoutKey, closePalettePopover]);

  useEffect(() => {
    if (!isOpen) closePalettePopover();
  }, [isOpen, closePalettePopover]);

  const handleSave = useCallback(async () => {
    if (!selectedImage) return;
    for (const raw of editColors) {
      const t = raw.trim();
      if (!t) continue;
      if (!canonicalHex(t)) {
        addToast(`Invalid hex color: ${t}`, "error", 3500);
        return;
      }
    }
    const colorsToSave = normalizedPalette(editColors);
    if (colorsToSave.length > MAX_PALETTE_COLORS) {
      addToast(`At most ${MAX_PALETTE_COLORS} palette colors`, "error", 3000);
      return;
    }
    setSaving(true);
    const ok = await trySaveImageDetails(selectedImage.id, tags, colorsToSave);
    addToast(
      ok ? "Details saved" : "Failed to save",
      ok ? "success" : "error",
      ok ? 2000 : undefined,
    );
    setSaving(false);
  }, [selectedImage, tags, editColors, addToast]);

  const submitRename = useCallback(async () => {
    if (!selectedImage) return;
    const trimmed = editName.trim();
    if (!trimmed || trimmed === selectedImage.name) {
      setEditName(selectedImage.name);
      return;
    }
    setRenaming(true);
    const updated = await tryPerformImageRename(selectedImage.id, trimmed);
    if (updated) {
      if (updated.name !== trimmed) {
        addToast(`Renamed to "${updated.name}" (original name was taken)`, "info", 3000);
      } else {
        addToast("Image renamed", "success", 2000);
      }
    } else {
      addToast("Failed to rename image", "error");
      setEditName(selectedImage.name);
    }
    setRenaming(false);
  }, [selectedImage, editName, addToast]);

  const hasChanges = useMemo(() => {
    const originalTags = selectedImage?.tags ?? [];
    if (originalTags.length !== tags.length) return true;
    const tagSet = new Set(originalTags);
    if (tags.some((t) => !tagSet.has(t))) return true;

    const originalColors = selectedImage?.colors ?? [];
    return !palettesEqual(editColors, originalColors);
  }, [selectedImage?.tags, selectedImage?.colors, tags, editColors]);

  return (
    <>
      {/* Overlay backdrop — click to close, same as left drawer */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
        role="button"
        tabIndex={isOpen ? 0 : -1}
        aria-label="close sidebar"
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full lg:w-[min(32rem,calc(100vw-2rem))] flex-col border-l border-base-300 bg-base-200 shadow-xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } ${isNeo ? "neo-card" : ""}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-base-content">
            Image Details
          </h3>
          <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={close}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {selectedImage && (
          <div
            ref={imageDetailBodyScrollRef}
            className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
          >
            {/* Preview */}
            {(() => {
              const thumb = selectedImage.thumbnails?.default?.trim();
              const webKind =
                selectedImage.media_type === "web"
                  ? webPreviewPlaybackKind(selectedImage.preview_path)
                  : null;
              const previewPath = selectedImage.preview_path?.trim();

              if (selectedImage.media_type === "video") {
                const videoSrc = selectedImage.preview_path?.trim() || selectedImage.path;
                return thumb || videoSrc ? (
                  <DetailHoverVideo src={videoSrc} poster={thumb || undefined} />
                ) : null;
              }

              if (webKind === "video" && previewPath) {
                return <DetailHoverVideo src={previewPath} poster={thumb || undefined} />;
              }

              if (webKind === "animatedImage" && previewPath) {
                return (
                  <img
                    src={previewPath}
                    alt={selectedImage.name}
                    className="w-full rounded-lg object-cover"
                  />
                );
              }

              if (thumb) {
                return (
                  <img
                    src={thumb}
                    alt={selectedImage.name}
                    className="w-full rounded-lg object-cover"
                  />
                );
              }
              return null;
            })()}

            {selectedImage.media_type === "video" && (
              <button
                type="button"
                className="btn btn-outline btn-sm w-full"
                onClick={() => {
                  close();
                  navigate("/loop-studio", {
                    state: { imageId: selectedImage.id },
                  });
                }}
              >
                Open in Loop Studio
              </button>
            )}

            {/* Editable name */}
            <div className="space-y-1">
              <label
                htmlFor="image-detail-name"
                className="text-xs font-semibold uppercase tracking-wide text-base-content/60"
              >
                Name
              </label>
              <input
                id="image-detail-name"
                ref={nameInputRef}
                type="text"
                className="input input-bordered input-sm w-full font-medium"
                value={editName}
                disabled={renaming}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => void submitRename()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    nameInputRef.current?.blur();
                  } else if (e.key === "Escape") {
                    setEditName(selectedImage.name);
                    nameInputRef.current?.blur();
                  }
                }}
              />
            </div>

            {/* Metadata */}
            <div className="space-y-1 text-xs text-base-content/70">
              <p>ID: {selectedImage.id}</p>
              <p>
                {selectedImage.width} &times; {selectedImage.height}
              </p>
              <p>
                {selectedImage.format.toUpperCase()} &middot;{" "}
                {formatFileSize(selectedImage.file_size)}
              </p>
            </div>

            {/* Palette — editable for all media types (videos/web ship empty until set) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                Palette
              </label>
              <p className="text-[10px] leading-snug text-base-content/50">
                Hex swatches stored on the gallery row and included in{" "}
                <code className="text-[10px]">wallpaper_changed</code> when non-empty — useful for
                hooks / ricing. Click a swatch to copy; double-click to edit color; hover for remove.
              </p>
              <div ref={paletteRowAnchorRef} className="flex flex-wrap items-center gap-2">
                {editColors.map((c, i) => (
                  <PaletteSwatchChip
                    key={i}
                    fill={swatchCssFill(c)}
                    isNeo={isNeo}
                    title="Copy hex · double-click to edit"
                    ariaLabelCopy={`Palette color ${i + 1}, click to copy`}
                    ariaLabelRemove={`Remove color ${i + 1}`}
                    onCopy={() =>
                      void copyPaletteColor(canonicalHex(c.trim()) ?? c.trim())
                    }
                    onOpenColorPopover={() => openPalettePopoverReplace(i, c)}
                    onRemove={() => removePaletteColor(i)}
                  />
                ))}
                <button
                  type="button"
                  disabled={editColors.length >= MAX_PALETTE_COLORS}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center border border-dashed border-base-content/30 text-lg font-light leading-none text-base-content/45 transition-colors hover:border-primary/45 hover:bg-primary/8 hover:text-primary disabled:pointer-events-none disabled:opacity-35 ${
                    isNeo
                      ? "rounded-none shadow-[2px_2px_0_0_color-mix(in_oklab,var(--fallback-bc,oklch(var(--bc))),12%),transparent)]"
                      : "rounded-lg"
                  }`}
                  aria-label="Add palette color"
                  title={
                    editColors.length >= MAX_PALETTE_COLORS
                      ? `At most ${MAX_PALETTE_COLORS} colors`
                      : "Pick a color to add"
                  }
                  onClick={() => openPalettePopoverAdd()}
                >
                  +
                </button>
              </div>
            </div>

            {selectedImage.media_type === "web" && (
              <WebWallpaperConfigForm
                key={selectedImage.id}
                image={selectedImage as DaemonImage}
                onUpdated={openDetailFromConfigForm}
              />
            )}

            {/* Tags */}
            <div className="space-y-2">
              <label
                htmlFor="image-detail-tags"
                className="text-xs font-semibold uppercase tracking-wide text-base-content/60"
              >
                Tags
              </label>

              {/* Current tags */}
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className="badge badge-primary gap-1 text-xs">
                    {tag}
                    <button
                      type="button"
                      className="ml-0.5 opacity-70 hover:opacity-100"
                      onClick={() => removeTag(tag)}
                    >
                      &times;
                    </button>
                  </span>
                ))}
                {tags.length === 0 && (
                  <span className="text-xs text-base-content/40">No tags yet</span>
                )}
              </div>

              {/* Tag input */}
              <div className="relative">
                <input
                  id="image-detail-tags"
                  ref={inputRef}
                  type="text"
                  className="input input-bordered input-sm w-full"
                  placeholder="Add a tag..."
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                />

                {/* Autocomplete dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-lg">
                    {suggestions.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-base-200"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addTag(s);
                          }}
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Save button */}
            <button
              type="button"
              className={`btn btn-primary btn-sm ${!hasChanges ? "btn-disabled" : ""}`}
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              {saving ? "Saving..." : "Save details"}
            </button>
          </div>
        )}
      </div>
      {palettePopover &&
        palettePopoverPosition &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[190] cursor-default bg-black/15"
              aria-label="Dismiss color picker"
              onClick={closePalettePopover}
            />
            <div
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              aria-label={
                palettePopover.mode === "add" ? "Add palette color" : "Edit palette color"
              }
              className={`fixed z-[200] border border-base-300 bg-base-100 p-3 shadow-2xl outline-none ${
                isNeo
                  ? "rounded-none shadow-[4px_4px_0_0_color-mix(in_oklab,var(--fallback-bc,oklch(var(--bc))),14%),transparent)]"
                  : "rounded-xl"
              }`}
              style={{
                left: palettePopoverPosition.left,
                top: palettePopoverPosition.top,
                width: PALETTE_POPOVER_PANEL_WIDTH,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex w-full justify-center [&_.react-colorful]:w-full">
                <HexColorPicker
                  color={palettePopover.draftHex}
                  onChange={handlePopoverColorChange}
                />
              </div>
              <PalettePopoverColorFields
                draftHex={palettePopover.draftHex}
                onPickHex={handlePopoverColorChange}
                isNeo={isNeo}
              />
              <button
                type="button"
                className={`btn btn-primary btn-sm mt-3 w-full ${isNeo ? "rounded-none" : ""}`}
                onClick={closePalettePopover}
              >
                Done
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

export default ImageDetailSidebar;
