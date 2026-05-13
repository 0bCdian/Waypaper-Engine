import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useLocation } from "react-router-dom";
import { useDropZone } from "@/hooks/useDropZone";
import { useHotkeys } from "react-hotkeys-hook";
import { captureShaderPreviewPngs } from "@/shaderStudio/captureShaderPreviewPngs";
import { serializeMultipass } from "@/shaderStudio/buildWallpaperPackage";
import {
  DEFAULT_PREVIEW_DT,
  DEFAULT_PREVIEW_FRAME_COUNT,
} from "@/shaderStudio/shaderPreviewSchedule";
import { SHADER_STUDIO_EXAMPLE } from "@/shaderStudio/exampleShader";
import { ShaderWallEngine } from "@/shaderStudio/shaderWallEngine";
import {
  parseShadertoyJson,
  prepareMultipassFromJson,
  type PreparedMultipass,
} from "@/shaderStudio/shadertoyImport";
import { ShadertoyMultipassEngine } from "@/shaderStudio/shadertoyMultipassEngine";
import { useFoldersStore } from "@/stores/foldersStore";
import { useImagesStore } from "@/stores/images";
import { useToastStore } from "@/stores/toastStore";
import { daemonClient } from "@/client";

const LS_SHADER = "waypaper.shaderStudio.shader";
const LS_TITLE = "waypaper.shaderStudio.title";

function safeGetLS(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

const api = window.API_RENDERER;

function tryParseShadertoyJson(
  text: string,
): { ok: true; prepared: PreparedMultipass } | { ok: false; error: string } {
  try {
    const data = parseShadertoyJson(text);
    const prepared = prepareMultipassFromJson(data);
    return { ok: true, prepared };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Import failed",
    };
  }
}

type ShaderPackagePayload = Parameters<typeof api.writeShaderWebWallpaperPackage>[0];

async function trySaveShaderToGallery(
  payload: ShaderPackagePayload,
  currentFolderId: number | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const w = await api.writeShaderWebWallpaperPackage(payload);
    if (w.canceled || !w.packageDir) return { ok: false, error: "Save was canceled" };
    await daemonClient.importWebWallpaper(w.packageDir, currentFolderId ?? undefined);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Import failed",
    };
  }
}

async function tryExportShaderPackage(
  payload: ShaderPackagePayload,
): Promise<{ ok: true; packageDir: string } | { ok: false; canceled?: boolean; error: string }> {
  try {
    const w = await api.writeShaderWebWallpaperPackage(payload);
    if (w.canceled) return { ok: false, canceled: true, error: "Export canceled" };
    return { ok: true, packageDir: w.packageDir ?? "" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Export failed",
    };
  }
}

function multipassEditorPlaceholder(title: string, passes: string[]): string {
  return `// Multipass Shadertoy import: ${title}
// Execution order (buffers then image): ${passes.join(" → ")}
// Save / export emits a multipass web wallpaper package (WebGL2 + EXT_color_buffer_float).
// Use "Clear import" to return to single-pass GLSL.`;
}

export default function ShaderStudio() {
  const location = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const singleEngineRef = useRef<ShaderWallEngine | null>(null);
  const multiEngineRef = useRef<ShadertoyMultipassEngine | null>(null);
  const multipassPreparedRef = useRef<PreparedMultipass | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addToast = useToastStore((s) => s.addToast);
  const reQueryImages = useImagesStore((s) => s.reQueryImages);
  const currentFolderId = useFoldersStore((s) => s.currentFolderId);

  const [importMode, setImportMode] = useState<"single" | "multipass">("single");
  const [passList, setPassList] = useState<string[]>([]);

  const [source, setSource] = useState(() => safeGetLS(LS_SHADER, SHADER_STUDIO_EXAMPLE));
  const [title, setTitle] = useState(() => safeGetLS(LS_TITLE, "My shader wallpaper"));
  const [logKind, setLogKind] = useState<"ok" | "err" | "info">("info");
  const [logMsg, setLogMsg] = useState("// Press Run or Ctrl+Enter to compile");
  const [compileOk, setCompileOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(LS_SHADER, source);
    } catch {
      /* ignore */
    }
  }, [source]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_TITLE, title);
    } catch {
      /* ignore */
    }
  }, [title]);

  const routeStateLoadedRef = useRef(false);

  const mountSingleEngine = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    multiEngineRef.current?.dispose();
    multiEngineRef.current = null;

    const eng = new ShaderWallEngine(canvas, { wallpaperMouse: false });
    if (!eng.init()) {
      singleEngineRef.current = null;
      return "WebGL could not be initialized in this window.";
    }
    eng.startLoop();
    singleEngineRef.current = eng;
    return null;
  }, []);

  useEffect(() => {
    const err = mountSingleEngine();
    let tid: ReturnType<typeof setTimeout> | undefined;
    if (err) {
      tid = setTimeout(() => {
        setLogKind("err");
        setLogMsg(err);
        setCompileOk(false);
      }, 0);
    }
    return () => {
      clearTimeout(tid);
      singleEngineRef.current?.dispose();
      singleEngineRef.current = null;
      multiEngineRef.current?.dispose();
      multiEngineRef.current = null;
    };
  }, [mountSingleEngine]);

  const runCompile = useCallback(() => {
    if (importMode === "multipass") {
      const eng = multiEngineRef.current;
      const prep = multipassPreparedRef.current;
      if (!eng || !prep) {
        setLogKind("err");
        setLogMsg("No multipass project loaded.");
        setCompileOk(false);
        return;
      }
      const r = eng.compile(prep);
      if (r.ok) {
        setCompileOk(true);
        setLogKind("ok");
        setLogMsg("// multipass compiled OK");
      } else {
        setCompileOk(false);
        setLogKind("err");
        setLogMsg(r.message);
      }
      return;
    }
    const eng = singleEngineRef.current;
    if (!eng) return;
    const trimmed = source.trim();
    if (!trimmed) {
      setLogKind("err");
      setLogMsg("Shader source is empty.");
      setCompileOk(false);
      return;
    }
    const r = eng.compile(trimmed);
    if (r.ok) {
      setCompileOk(true);
      setLogKind("ok");
      setLogMsg("// compiled OK");
    } else {
      setCompileOk(false);
      setLogKind("err");
      setLogMsg(r.message);
    }
  }, [source, importMode]);

  useHotkeys(
    "mod+enter",
    (e) => {
      e.preventDefault();
      runCompile();
    },
    { enableOnFormTags: true, enableOnContentEditable: true },
    [runCompile],
  );

  const loadExample = useCallback(() => {
    multiEngineRef.current?.dispose();
    multiEngineRef.current = null;
    multipassPreparedRef.current = null;
    setImportMode("single");
    setPassList([]);
    const mountErr = mountSingleEngine();
    setSource(SHADER_STUDIO_EXAMPLE);
    if (mountErr) {
      setLogKind("err");
      setLogMsg(mountErr);
    } else {
      setLogKind("info");
      setLogMsg("// loaded example — press Run");
    }
    setCompileOk(false);
  }, [mountSingleEngine]);

  const clearImport = useCallback(() => {
    multiEngineRef.current?.dispose();
    multiEngineRef.current = null;
    multipassPreparedRef.current = null;
    setImportMode("single");
    setPassList([]);
    setSource(SHADER_STUDIO_EXAMPLE);
    setCompileOk(false);
    const mountErr = mountSingleEngine();
    if (mountErr) {
      setLogKind("err");
      setLogMsg(mountErr);
    } else {
      setLogKind("info");
      setLogMsg("// Cleared import — press Run after editing");
    }
  }, [mountSingleEngine]);

  const loadShadertoyJsonText = useCallback(
    (text: string) => {
      const parseResult = tryParseShadertoyJson(text);
      if (!parseResult.ok) {
        addToast(parseResult.error, "error");
        setLogKind("err");
        setLogMsg(parseResult.error);
        mountSingleEngine();
        return;
      }
      const { prepared } = parseResult;
      const canvas = canvasRef.current;
      if (!canvas) return;

      singleEngineRef.current?.dispose();
      singleEngineRef.current = null;

      const eng = new ShadertoyMultipassEngine(canvas);
      if (!eng.init()) {
        addToast("WebGL2 is required for multipass Shadertoy import", "error");
        mountSingleEngine();
        return;
      }
      const cr = eng.compile(prepared);
      if (!cr.ok) {
        addToast(cr.message, "error");
        setLogKind("err");
        setLogMsg(cr.message);
        setCompileOk(false);
        eng.dispose();
        mountSingleEngine();
        return;
      }
      eng.startLoop();
      multiEngineRef.current = eng;
      multipassPreparedRef.current = prepared;

      const order = [
        ...prepared.buffers.map((b) => (b.name as string) ?? "buffer"),
        prepared.image.name ?? "image",
      ];
      setPassList(order);
      setImportMode("multipass");
      setTitle(prepared.title);
      setSource(multipassEditorPlaceholder(prepared.title, order));
      setCompileOk(true);
      setLogKind("ok");
      setLogMsg(
        `// Imported multipass (${order.length} executable passes). Unsupported: sound, VR, webcam, cubemap media, music stream.`,
      );
    },
    [addToast, mountSingleEngine],
  );

  // Load shadertoy JSON passed via route state (navigated from Gallery drop prompt).
  useEffect(() => {
    if (routeStateLoadedRef.current) return;
    routeStateLoadedRef.current = true;
    const state = location.state as { shadertoyJsonText?: string } | null;
    if (state?.shadertoyJsonText) {
      loadShadertoyJsonText(state.shadertoyJsonText);
      window.history.replaceState({}, "");
    }
  }, [location.state, loadShadertoyJsonText]);

  const onPickShadertoyJson = (ev: ChangeEvent<HTMLInputElement>): void => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    void file.text().then((t) => loadShadertoyJsonText(t));
  };

  const handleShaderDrop = useCallback(
    (e: React.DragEvent) => {
      const { files } = e.dataTransfer;
      const f = files[0];
      if (!f) return;
      if (!f.name.toLowerCase().endsWith(".json")) {
        addToast("Drop a Shadertoy export .json file", "warning", 3000);
        return;
      }
      void f.text().then((t) => loadShadertoyJsonText(t));
    },
    [addToast, loadShadertoyJsonText],
  );

  const { isDragging: isShaderDragging, handlers: shaderDropHandlers } =
    useDropZone(handleShaderDrop);

  const togglePause = useCallback(() => {
    if (importMode === "multipass") {
      const eng = multiEngineRef.current;
      if (!eng) return;
      eng.setPlaying(!eng.isRunning());
    } else {
      const s = singleEngineRef.current;
      if (s) s.setPlaying(!s.isRunning());
    }
  }, [importMode]);

  const resetTime = useCallback(() => {
    if (importMode === "multipass") multiEngineRef.current?.resetTime();
    else singleEngineRef.current?.resetTime();
  }, [importMode]);

  const buildPackagePayload = useCallback(
    (mode: "temp" | "export") => {
      const t = title.trim() || "Shader wallpaper";
      if (importMode === "multipass") {
        const prepared = multipassPreparedRef.current;
        if (!prepared) return null;
        return {
          kind: "multipass" as const,
          multipass: serializeMultipass(prepared),
          title: t,
          mode,
        };
      }
      return { kind: "single" as const, shader: source, title: t, mode };
    },
    [importMode, source, title],
  );

  const capturePreviewPngsForPackage = useCallback(async (): Promise<Uint8Array[] | undefined> => {
    const dt = DEFAULT_PREVIEW_DT;
    const caps = await captureShaderPreviewPngs(
      importMode === "multipass"
        ? {
            mode: "multipass",
            prepared: multipassPreparedRef.current!,
          }
        : { mode: "single", shader: source },
      { dt, frameCount: DEFAULT_PREVIEW_FRAME_COUNT },
    );
    return caps && caps.length > 0 ? caps : undefined;
  }, [importMode, source]);

  const saveToGallery = useCallback(async () => {
    if (!compileOk) {
      addToast("Compile successfully before saving to the gallery", "error");
      return;
    }
    const payload = buildPackagePayload("temp");
    if (!payload) {
      addToast("No project to save", "error");
      return;
    }
    setSaving(true);
    const previewPngBuffers = await capturePreviewPngsForPackage();
    const saveResult = await trySaveShaderToGallery(
      {
        ...payload,
        previewPngBuffers,
        previewFps: Math.round(1 / DEFAULT_PREVIEW_DT),
      },
      currentFolderId,
    );
    if (saveResult.ok) {
      addToast("Shader web wallpaper imported into gallery", "success");
      void reQueryImages();
    } else {
      addToast(saveResult.error, "error");
    }
    setSaving(false);
  }, [
    addToast,
    buildPackagePayload,
    capturePreviewPngsForPackage,
    compileOk,
    currentFolderId,
    reQueryImages,
  ]);

  const exportPackage = useCallback(async () => {
    if (!compileOk) {
      addToast("Compile successfully before exporting", "error");
      return;
    }
    const payload = buildPackagePayload("export");
    if (!payload) {
      addToast("No project to export", "error");
      return;
    }
    setExporting(true);
    const previewPngBuffers = await capturePreviewPngsForPackage();
    const exportResult = await tryExportShaderPackage({
      ...payload,
      previewPngBuffers,
      previewFps: Math.round(1 / DEFAULT_PREVIEW_DT),
    });
    if (exportResult.ok) {
      addToast(`Exported to ${exportResult.packageDir}`, "success");
    } else {
      addToast(exportResult.error, exportResult.canceled ? "info" : "error");
    }
    setExporting(false);
  }, [addToast, buildPackagePayload, capturePreviewPngsForPackage, compileOk]);

  const logClass =
    logKind === "ok" ? "text-success" : logKind === "err" ? "text-error" : "text-info";

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden px-2 py-2 sm:gap-3 sm:px-4 sm:py-3"
      {...shaderDropHandlers}
    >
      {isShaderDragging && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-base-300/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-dashed border-secondary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-16 text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <span className="text-2xl font-bold text-secondary">Drop Shadertoy .json</span>
            <span className="text-sm text-base-content/60">Single-pass or multipass export</span>
          </div>
        </div>
      )}
      <header className="shrink-0 space-y-1">
        <h1 className="text-xl font-semibold text-base-content sm:text-2xl">Shader Studio</h1>
        <p className="line-clamp-2 text-xs text-base-content/60 sm:line-clamp-none sm:text-sm">
          Shadertoy-style <code className="text-xs">mainImage</code> fragment shaders. Run compiles
          the preview; save writes a web wallpaper package and imports it into the gallery, or
          export copies the package to a folder you choose. Multipass shaders need a full Shadertoy
          JSON export (official Export or a compatible browser extension), not the Image tab alone.
        </p>
      </header>

      <div className="alert alert-info shrink-0 py-1.5 text-xs sm:text-sm">
        <span>
          <kbd className="kbd kbd-sm">Ctrl</kbd>+<kbd className="kbd kbd-sm">Enter</kbd> compiles.
          Mouse over the preview drives <code className="text-xs">iMouse</code>.{" "}
          <code className="text-xs">fragCoord</code> matches Shadertoy (top-left origin). Import
          JSON for Common + Buffer + Image pipelines (WebGL2), or drop a{" "}
          <code className="text-xs">.json</code> export onto this page.
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-hidden
        onChange={onPickShadertoyJson}
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <input
          type="text"
          className="input input-bordered input-sm min-w-0 flex-1 basis-[min(100%,14rem)] sm:basis-64"
          placeholder="Wallpaper title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Wallpaper title"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => runCompile()}>
            Run
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Import JSON…
          </button>
          {importMode === "multipass" ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={clearImport}>
              Clear import
            </button>
          ) : null}
          <button type="button" className="btn btn-outline btn-sm" onClick={loadExample}>
            Example
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={togglePause}>
            Pause / play
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={resetTime}>
            Reset time
          </button>
          <button
            type="button"
            className="btn btn-success btn-sm"
            disabled={saving}
            onClick={() => void saveToGallery()}
          >
            {saving ? "Saving…" : "Save to gallery"}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={exporting}
            onClick={() => void exportPackage()}
          >
            {exporting ? "Export…" : "Export folder…"}
          </button>
        </div>
      </div>

      {passList.length > 0 ? (
        <div className="shrink-0 rounded border border-base-300 bg-base-200 px-2 py-1 text-[11px] text-base-content/80 sm:text-xs">
          <span className="font-semibold text-base-content/60">Passes: </span>
          {passList.join(" → ")}
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:gap-3">
        <section className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-base-300 bg-base-200 lg:max-w-[55%]">
          <div className="shrink-0 border-b border-base-300 px-2 py-1 text-[10px] uppercase tracking-wide text-base-content/50">
            {importMode === "multipass" ? "import (read-only)" : "fragment.glsl"}
          </div>
          <textarea
            className="min-h-0 flex-1 resize-none bg-base-100 p-2 font-mono text-xs text-base-content focus:outline-none focus:ring-1 focus:ring-primary sm:p-3 sm:text-sm disabled:opacity-60"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="GLSL shader source"
            disabled={importMode === "multipass"}
          />
          <pre
            className={`max-h-24 shrink-0 overflow-auto border-t border-base-300 bg-base-300/30 p-2 font-mono text-[11px] whitespace-pre-wrap break-all sm:max-h-28 sm:text-xs ${logClass}`}
          >
            {logMsg}
          </pre>
        </section>
        <section className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-base-300 bg-black">
          <div className="shrink-0 border-b border-base-300 bg-base-200 px-2 py-1 text-[10px] uppercase tracking-wide text-base-content/50">
            Preview
          </div>
          <div className="relative min-h-0 flex-1">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 m-auto block h-full max-h-full w-full max-w-full cursor-crosshair object-contain"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
