import { useCallback, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { SHADER_STUDIO_EXAMPLE } from "@/shaderStudio/exampleShader";
import { ShaderWallEngine } from "@/shaderStudio/shaderWallEngine";
import { useFoldersStore } from "@/stores/foldersStore";
import { useImagesStore } from "@/stores/images";
import { useToastStore } from "@/stores/toastStore";

const LS_SHADER = "waypaper.shaderStudio.shader";
const LS_TITLE = "waypaper.shaderStudio.title";

const goDaemon = window.API_RENDERER.goDaemon;
const api = window.API_RENDERER;

export default function ShaderStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ShaderWallEngine | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  const reQueryImages = useImagesStore((s) => s.reQueryImages);
  const currentFolderId = useFoldersStore((s) => s.currentFolderId);

  const [source, setSource] = useState(() => {
    try {
      const s = localStorage.getItem(LS_SHADER);
      return s ?? SHADER_STUDIO_EXAMPLE;
    } catch {
      return SHADER_STUDIO_EXAMPLE;
    }
  });
  const [title, setTitle] = useState(() => {
    try {
      return localStorage.getItem(LS_TITLE) ?? "My shader wallpaper";
    } catch {
      return "My shader wallpaper";
    }
  });
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const eng = new ShaderWallEngine(canvas, { wallpaperMouse: false });
    if (!eng.init()) {
      setLogKind("err");
      setLogMsg("WebGL could not be initialized in this window.");
      setCompileOk(false);
      return;
    }
    eng.startLoop();
    engineRef.current = eng;
    return () => {
      eng.dispose();
      engineRef.current = null;
    };
  }, []);

  const runCompile = useCallback(() => {
    const eng = engineRef.current;
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
  }, [source]);

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
    setSource(SHADER_STUDIO_EXAMPLE);
    setLogKind("info");
    setLogMsg("// loaded example — press Run");
    setCompileOk(false);
  }, []);

  const togglePause = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setPlaying(!eng.isRunning());
  }, []);

  const resetTime = useCallback(() => {
    engineRef.current?.resetTime();
  }, []);

  const saveToGallery = useCallback(async () => {
    if (!compileOk) {
      addToast("Compile successfully before saving to the gallery", "error");
      return;
    }
    setSaving(true);
    try {
      const w = await api.writeShaderWebWallpaperPackage({
        shader: source,
        title: title.trim() || "Shader wallpaper",
        mode: "temp",
      });
      if (w.canceled || !w.packageDir) {
        addToast("Save was canceled", "error");
        return;
      }
      await goDaemon.importWebWallpaper(w.packageDir, currentFolderId ?? undefined);
      addToast("Shader web wallpaper imported into gallery", "success");
      void reQueryImages();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Import failed", "error");
    } finally {
      setSaving(false);
    }
  }, [addToast, compileOk, currentFolderId, reQueryImages, source, title]);

  const exportPackage = useCallback(async () => {
    if (!compileOk) {
      addToast("Compile successfully before exporting", "error");
      return;
    }
    setExporting(true);
    try {
      const w = await api.writeShaderWebWallpaperPackage({
        shader: source,
        title: title.trim() || "Shader wallpaper",
        mode: "export",
      });
      if (w.canceled) {
        addToast("Export canceled", "info");
        return;
      }
      addToast(`Exported to ${w.packageDir}`, "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  }, [addToast, compileOk, source, title]);

  const logClass =
    logKind === "ok" ? "text-success" : logKind === "err" ? "text-error" : "text-info";

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden px-2 py-2 sm:gap-3 sm:px-4 sm:py-3">
      <header className="shrink-0 space-y-1">
        <h1 className="text-xl font-bold text-base-content sm:text-2xl">Shader Studio</h1>
        <p className="line-clamp-2 text-xs text-base-content/60 sm:line-clamp-none sm:text-sm">
          Shadertoy-style <code className="text-xs">mainImage</code> fragment shaders. Run compiles the preview; save
          writes a web wallpaper package and imports it into the gallery, or export copies the package to a folder you
          choose.
        </p>
      </header>

      <div className="alert alert-info shrink-0 py-1.5 text-xs sm:text-sm">
        <span>
          <kbd className="kbd kbd-sm">Ctrl</kbd>+<kbd className="kbd kbd-sm">Enter</kbd> compiles. Mouse over the
          preview drives <code className="text-xs">iMouse</code>.
        </span>
      </div>

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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:gap-3">
        <section className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-base-300 bg-base-200 lg:max-w-[55%]">
          <div className="shrink-0 border-b border-base-300 px-2 py-1 text-[10px] uppercase tracking-wide text-base-content/50">
            fragment.glsl
          </div>
          <textarea
            className="min-h-0 flex-1 resize-none bg-base-100 p-2 font-mono text-xs text-base-content focus:outline-none focus:ring-1 focus:ring-primary sm:p-3 sm:text-sm"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="GLSL shader source"
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
