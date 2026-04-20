import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
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

const { goDaemon } = window.API_RENDERER;

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

async function saveImageTags(imageId: number, tags: string[]) {
  await goDaemon.updateImage(imageId, { tags });
  const freshImage = await goDaemon.getImage(imageId);
  useImageDetailStore.getState().open(freshImage);
  useImagesStore.getState().reQueryImages();
}

async function performImageRename(imageId: number, newName: string) {
  const updated = await useImagesStore.getState().renameImage(imageId, newName);
  useImageDetailStore
    .getState()
    .open(updated as unknown as import("../../electron/daemon-go-types").Image);
  return updated;
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

  const [overrides, setOverrides] = useState<Record<string, unknown>>(() => ({
    ...image.wallpaper_config_overrides,
  }));
  const [caps, setCaps] = useState<WebCapabilities>(() => normalizeWebCaps(meta?.capabilities));
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const capsRef = useRef(caps);
  capsRef.current = caps;

  const serverOverridesKey = useMemo(
    () => JSON.stringify(image.wallpaper_config_overrides ?? {}),
    [image.wallpaper_config_overrides],
  );

  const serverCapsKey = useMemo(
    () => JSON.stringify(normalizeWebCaps(meta?.capabilities)),
    [image.id, meta?.capabilities],
  );

  const dirtyOverrides = useMemo(
    () => JSON.stringify(overrides) !== serverOverridesKey,
    [overrides, serverOverridesKey],
  );

  const dirtyCaps = useMemo(() => JSON.stringify(caps) !== serverCapsKey, [caps, serverCapsKey]);

  const dirty = dirtyOverrides || dirtyCaps;

  useEffect(() => {
    const next = { ...image.wallpaper_config_overrides };
    setOverrides((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    setSaveError(false);
  }, [image.id, serverOverridesKey]);

  useEffect(() => {
    const next = normalizeWebCaps(image.web_meta?.capabilities);
    setCaps((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    capsRef.current = next;
    setSaveError(false);
  }, [image.id, serverCapsKey]);

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
    try {
      const update: {
        wallpaper_config_overrides?: Record<string, unknown>;
        web_capabilities?: Partial<WebCapabilities>;
      } = {};
      if (dirtyOverrides) update.wallpaper_config_overrides = overridesRef.current;
      if (dirtyCaps) update.web_capabilities = capsRef.current;
      const updated = await goDaemon.updateImage(image.id, update);
      onUpdated(updated);
      addToast("Web wallpaper saved", "success");
    } catch (e) {
      setSaveError(true);
      addToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusy(false);
    }
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
            enable outbound fetch/XHR/WebSocket (manifest <code className="text-[10px]">network</code>{" "}
            must still be on).
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

function ImageDetailSidebar() {
  const navigate = useNavigate();
  const { selectedImage, isOpen, close } = useImageDetailStore(
    useShallow((s) => ({ selectedImage: s.selectedImage, isOpen: s.isOpen, close: s.close })),
  );
  const addToast = useToastStore((s) => s.addToast);
  const copyPaletteColor = useCallback(
    async (hex: string) => {
      try {
        await navigator.clipboard.writeText(hex);
        const display = hex.length > 28 ? `${hex.slice(0, 28)}…` : hex;
        addToast(`Copied to clipboard: ${display}`, "success", 2500);
      } catch {
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
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedImage) {
      setTags([...(selectedImage.tags ?? [])]);
      setEditName(selectedImage.name);
    }
  }, [selectedImage]);

  useEffect(() => {
    if (isOpen) {
      void goDaemon
        .getImageTags()
        .then((resp) => {
          setAllTags(resp.tags ?? []);
        })
        .catch(() => {});
    }
  }, [isOpen]);

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

  const handleSave = useCallback(async () => {
    if (!selectedImage) return;
    setSaving(true);
    try {
      await saveImageTags(selectedImage.id, tags);
      addToast("Tags saved", "success", 2000);
    } catch {
      addToast("Failed to save tags", "error");
    } finally {
      setSaving(false);
    }
  }, [selectedImage, tags, addToast]);

  const submitRename = useCallback(async () => {
    if (!selectedImage) return;
    const trimmed = editName.trim();
    if (!trimmed || trimmed === selectedImage.name) {
      setEditName(selectedImage.name);
      return;
    }
    setRenaming(true);
    try {
      const updated = await performImageRename(selectedImage.id, trimmed);
      if (updated.name !== trimmed) {
        addToast(`Renamed to "${updated.name}" (original name was taken)`, "info", 3000);
      } else {
        addToast("Image renamed", "success", 2000);
      }
    } catch {
      addToast("Failed to rename image", "error");
      setEditName(selectedImage.name);
    } finally {
      setRenaming(false);
    }
  }, [selectedImage, editName, addToast]);

  const hasChanges = useMemo(() => {
    const original = selectedImage?.tags ?? [];
    if (original.length !== tags.length) return true;
    const s = new Set(original);
    return tags.some((t) => !s.has(t));
  }, [selectedImage?.tags, tags]);

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
        className={`fixed inset-y-0 right-0 z-50 flex w-full lg:w-80 flex-col border-l border-base-300 bg-base-200 shadow-xl transition-transform duration-300 ease-in-out ${
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
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
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
                  navigate("/loop-studio", { state: { imageId: selectedImage.id } });
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

            {/* Color Palette */}
            {selectedImage.colors && selectedImage.colors.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                  Colors
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedImage.colors.map((c, i) => (
                    <button
                      type="button"
                      key={`${c}-${i}`}
                      className="w-6 h-6 rounded border border-base-content/20 cursor-pointer tooltip p-0"
                      style={{ backgroundColor: c }}
                      data-tip={c}
                      title={c}
                      aria-label={`Copy color ${c}`}
                      onClick={() => void copyPaletteColor(c)}
                    />
                  ))}
                </div>
              </div>
            )}

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
              {saving ? "Saving..." : "Save Tags"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default ImageDetailSidebar;
