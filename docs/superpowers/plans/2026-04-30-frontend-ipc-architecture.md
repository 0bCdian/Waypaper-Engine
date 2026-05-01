# Frontend IPC Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-maintained TypeScript types with OpenAPI-generated ones, replace the stringly-typed IPC dispatch with a fully type-safe discriminated union, and introduce a renderer-side daemon client singleton that severs all `window.API_RENDERER.goDaemon.*` direct calls from stores and hooks.

**Architecture:** Tasks run sequentially: (1) wire `openapi-typescript` codegen into the build pipeline so types are always fresh; (2) replace the single `"go-daemon-command"` string channel with a typed `"daemon"` channel carrying a discriminated union and a request→response type map; (3) introduce `src/client/daemonClient.ts` as the singleton seam between React and the Electron preload, replacing all `window.API_RENDERER.goDaemon.*` calls in stores and hooks.

**Tech Stack:** TypeScript 5, Electron IPC, `openapi-typescript` (npm), Zustand, Vite, swag (Go OpenAPI generation)

---

## File Map

### New files

- `src/client/daemonClient.ts` — renderer-side singleton wrapping `window.API_RENDERER.goDaemon`
- `src/client/index.ts` — re-export of `daemonClient` for clean imports
- `src/test/mocks/daemonClient.ts` — vi.fn() mock for all daemon client methods
- `electron/ipc-types.ts` — discriminated union `DaemonRequest`, response map `DaemonResponse<T>`, all param/result types

### Modified files

- `package.json` — add `openapi-typescript` dev dep, wire `generate:types` into `build:daemon`
- `Makefile` — add TypeScript type generation step after swag
- `electron/daemon-go-types.generated.ts` — generated file (never hand-edit); replaces `electron/daemon-go-types.ts`
- `electron/preload.ts` — typed `invoke` helper using `DaemonRequest`/`DaemonResponse`
- `electron/managers/IPCManager.ts` — switch on `req.type` discriminant instead of string action
- `shared/types/image.ts` — extend from generated base types
- `shared/types/playlist.ts` — extend from generated base types
- `shared/types/unifiedConfig.ts` — extend from generated base types
- `src/types/electron.d.ts` — update `API_RENDERER.goDaemon` shape to match new preload
- `src/stores/*.ts` — replace `window.API_RENDERER.goDaemon.*` with `daemonClient.*`
- `src/hooks/*.ts` — replace `window.API_RENDERER.goDaemon.on(...)` with `daemonClient.on(...)`
- `src/test/mocks/apiRenderer.ts` — update goDaemon mock to delegate to `daemonClient` mock

### Deleted files

- `electron/daemon-go-types.ts` — replaced by `daemon-go-types.generated.ts`
- `electron/ipcEnvelope.ts` — replaced by typed channel; no longer needed

---

## Task 1: Wire `openapi-typescript` codegen into build pipeline

**Files:**

- Modify: `package.json`
- Modify: `Makefile`
- Create: `electron/daemon-go-types.generated.ts` (auto-generated, committed)

- [ ] **Step 1: Install `openapi-typescript`**

```bash
cd waypaper-engine && npm install --save-dev openapi-typescript@7
```

- [ ] **Step 2: Add `generate:types` script to `package.json`**

In `package.json`, add to the `"scripts"` section after `"generate:openapi"`:

```json
"generate:types": "openapi-typescript daemon/docs/openapi.yaml -o electron/daemon-go-types.generated.ts",
"ci:types": "npm run generate:types && git diff --exit-code -- electron/daemon-go-types.generated.ts"
```

Update `"build:daemon"` to run type generation after the Go build:

```json
"build:daemon": "make daemon && npm run generate:types",
```

- [ ] **Step 3: Run codegen for the first time**

```bash
cd waypaper-engine && npm run generate:types
```

Expected: `electron/daemon-go-types.generated.ts` is created with TypeScript types matching the OpenAPI spec.

- [ ] **Step 4: Verify the generated file is valid TypeScript**

```bash
cd waypaper-engine && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: no errors from the generated file itself.

- [ ] **Step 5: Update `shared/types/image.ts` to extend from generated types**

Open `electron/daemon-go-types.generated.ts` and find the generated `Image` type name (openapi-typescript uses `components["schemas"]["Image"]` or similar path — check the generated file). Then update `shared/types/image.ts`:

```typescript
import type { components } from "../../electron/daemon-go-types.generated";

// Base wire type from the Go API (generated from openapi.yaml).
export type Image = components["schemas"]["Image"];

// Frontend-augmented image type with UI-specific fields.
export type RendererImage = Image & {
  // UI selection state — not part of the wire protocol.
  uiSelected?: boolean;
};
```

Repeat the same pattern for `shared/types/playlist.ts` and `shared/types/unifiedConfig.ts`, extending the corresponding generated schema types.

- [ ] **Step 6: Delete `electron/daemon-go-types.ts`**

```bash
rm waypaper-engine/electron/daemon-go-types.ts
```

Fix all import paths in `electron/` that previously imported from `"./daemon-go-types"`:

```bash
grep -rl '"./daemon-go-types"' waypaper-engine/electron/ | xargs sed -i 's|"./daemon-go-types"|"./daemon-go-types.generated"|g'
```

- [ ] **Step 7: Verify full TypeScript compilation**

```bash
cd waypaper-engine && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json electron/daemon-go-types.generated.ts electron/preload.ts shared/types/ && git rm electron/daemon-go-types.ts
git commit -m "feat(types): wire openapi-typescript codegen into build:daemon; generated types replace hand-maintained daemon-go-types.ts; shared/types extend generated base types"
```

---

## Task 2: Define typed IPC discriminated union in `electron/ipc-types.ts`

**Files:**

- Create: `electron/ipc-types.ts`

- [ ] **Step 1: Write a failing type test**

Create `electron/ipc-types.test-types.ts` (compile-only, no runtime):

```typescript
// This file must compile without errors after Task 2 is complete.
import type { DaemonRequest, DaemonResponse } from "./ipc-types";

// Type-level test: get_images request must have typed params.
type _1 = DaemonRequest & { type: "get_images" };
// Type-level test: response for get_images must have items and total.
type _2 = DaemonResponse<_1>;
declare const r: _2;
const _total: number = r.total;
const _items: unknown[] = r.items;
```

```bash
cd waypaper-engine && npx tsc --noEmit electron/ipc-types.test-types.ts 2>&1 | head -5
```

Expected: error — `ipc-types` module not found.

- [ ] **Step 2: Create `electron/ipc-types.ts`**

```typescript
import type { components, paths } from "./daemon-go-types.generated";

// ---------------------------------------------------------------------------
// Re-exported daemon wire types (derive from generated schemas).
// ---------------------------------------------------------------------------
export type Image = components["schemas"]["Image"];
export type Playlist = components["schemas"]["Playlist"];
export type Folder = components["schemas"]["Folder"];
export type Monitor = components["schemas"]["Monitor"];
export type BackendInfo = components["schemas"]["BackendInfo"];
export type DaemonInfo = components["schemas"]["DaemonInfo"];
export type ImageHistoryEntry = components["schemas"]["ImageHistoryEntry"];
export type WallpaperCurrent = components["schemas"]["WallpaperCurrent"];
export type ActivePlaylistInstance =
  components["schemas"]["ActivePlaylistInstance"];
export type UnifiedConfig = components["schemas"]["UnifiedConfig"];

// ---------------------------------------------------------------------------
// Param types (used by preload and IPCManager).
// ---------------------------------------------------------------------------
export interface ImageQueryParams {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  media_type?: string;
  search?: string;
  tags?: string;
  folder_id?: number | "root";
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface SetWallpaperParams {
  image_id: number;
  monitor?: string;
  mode?: "individual" | "clone" | "extend";
}

export interface ImportImagesParams {
  paths: string[];
  folder_id?: number;
}

export interface VideoLoopExportRequest {
  in_seconds: number;
  out_seconds: number;
  preset: string;
  action: string;
  folder_id?: number;
  blend_halves: boolean;
}

export interface VideoLoopExportResult {
  image_id: number;
  path: string;
}

export interface UpdateImageParams {
  id: number;
  updates: Record<string, unknown>;
}

export interface CreatePlaylistParams {
  name: string;
  configuration: Playlist["configuration"];
}

export interface CreateFolderParams {
  name: string;
  parent_id?: number;
}

export interface MoveImagesParams {
  image_ids: number[];
  folder_id: number | null;
}

// ---------------------------------------------------------------------------
// Discriminated union of all daemon requests.
// ---------------------------------------------------------------------------
export type DaemonRequest =
  // Health
  | { type: "ping" }
  | { type: "get_info" }
  | { type: "get_capabilities" }
  | { type: "shutdown" }
  // Images
  | { type: "get_images"; params: ImageQueryParams }
  | { type: "get_image"; params: { id: number } }
  | { type: "ensure_browser_preview"; params: { id: number; force?: boolean } }
  | {
      type: "video_loop_export";
      params: { id: number; body: VideoLoopExportRequest };
    }
  | { type: "import_images"; params: ImportImagesParams }
  | {
      type: "import_web_wallpaper";
      params: { path: string; folder_id?: number };
    }
  | { type: "cancel_import" }
  | { type: "delete_images"; params: { ids: number[] } }
  | { type: "update_image"; params: UpdateImageParams }
  | { type: "select_all_images"; params: { selected: boolean } }
  | { type: "get_image_tags" }
  | { type: "get_image_history"; params: { monitor?: string; limit?: number } }
  | { type: "clear_image_history" }
  // Wallpaper
  | { type: "get_current_wallpapers" }
  | { type: "set_wallpaper"; params: SetWallpaperParams }
  | { type: "random_wallpaper"; params: { monitor?: string; mode?: string } }
  // Playlists
  | { type: "get_playlists" }
  | { type: "get_playlist"; params: { id: number } }
  | { type: "create_playlist"; params: CreatePlaylistParams }
  | {
      type: "update_playlist";
      params: { id: number; updates: Partial<Playlist> };
    }
  | { type: "delete_playlist"; params: { id: number } }
  | {
      type: "start_playlist";
      params: { id: number; monitor?: string; mode?: string };
    }
  | { type: "stop_playlist"; params: { id: number } }
  | { type: "pause_playlist"; params: { id: number } }
  | { type: "resume_playlist"; params: { id: number } }
  | { type: "next_playlist_image"; params: { id: number } }
  | { type: "previous_playlist_image"; params: { id: number } }
  | { type: "get_active_playlists" }
  | { type: "get_active_playlist_for_monitor"; params: { monitor: string } }
  | { type: "stop_all_playlists" }
  | { type: "pause_all_playlists" }
  | { type: "resume_all_playlists" }
  | { type: "next_all_playlists" }
  | { type: "previous_all_playlists" }
  // Folders
  | { type: "get_folders" }
  | { type: "get_folder"; params: { id: number } }
  | { type: "get_folder_path"; params: { id: number } }
  | { type: "create_folder"; params: CreateFolderParams }
  | { type: "update_folder"; params: { id: number; name: string } }
  | { type: "delete_folder"; params: { id: number } }
  | { type: "move_images_to_folder"; params: MoveImagesParams }
  // Monitors
  | { type: "get_monitors" }
  | { type: "get_monitor"; params: { name: string } }
  // Config
  | { type: "get_config" }
  | { type: "update_config"; params: Record<string, unknown> }
  | { type: "get_config_section"; params: { section: string } }
  | {
      type: "update_config_section";
      params: { section: string; data: Record<string, unknown> };
    }
  | { type: "get_backend_config"; params: { name: string } }
  | {
      type: "update_backend_config";
      params: { name: string; patch: Record<string, unknown> };
    }
  // Backends
  | { type: "get_backends" }
  | { type: "get_backend_capabilities"; params: { name: string } }
  | { type: "activate_backend"; params: { name: string } };

// ---------------------------------------------------------------------------
// Response type map — indexed by request type.
// ---------------------------------------------------------------------------
export type DaemonResponse<T extends DaemonRequest> = T extends { type: "ping" }
  ? boolean
  : T extends { type: "get_info" }
    ? DaemonInfo
    : T extends { type: "get_capabilities" }
      ? { ffmpeg_available: boolean }
      : T extends { type: "shutdown" }
        ? void
        : T extends { type: "get_images" }
          ? PaginatedResponse<Image>
          : T extends { type: "get_image" }
            ? Image
            : T extends { type: "ensure_browser_preview" }
              ? Image
              : T extends { type: "video_loop_export" }
                ? VideoLoopExportResult
                : T extends { type: "import_images" }
                  ? { status: string; total: number }
                  : T extends { type: "import_web_wallpaper" }
                    ? { status: string }
                    : T extends { type: "cancel_import" }
                      ? void
                      : T extends { type: "delete_images" }
                        ? { deleted: number }
                        : T extends { type: "update_image" }
                          ? Image
                          : T extends { type: "select_all_images" }
                            ? { updated: number; selected: boolean }
                            : T extends { type: "get_image_tags" }
                              ? { tags: string[] }
                              : T extends { type: "get_image_history" }
                                ? ImageHistoryEntry[]
                                : T extends { type: "clear_image_history" }
                                  ? void
                                  : T extends { type: "get_current_wallpapers" }
                                    ? WallpaperCurrent
                                    : T extends { type: "set_wallpaper" }
                                      ? { status: string; image_id: number }
                                      : T extends { type: "random_wallpaper" }
                                        ? { status: string; image_id: number }
                                        : T extends { type: "get_playlists" }
                                          ? Playlist[]
                                          : T extends { type: "get_playlist" }
                                            ? Playlist
                                            : T extends {
                                                  type: "create_playlist";
                                                }
                                              ? Playlist
                                              : T extends {
                                                    type: "update_playlist";
                                                  }
                                                ? Playlist
                                                : T extends {
                                                      type: "delete_playlist";
                                                    }
                                                  ? void
                                                  : T extends {
                                                        type: "start_playlist";
                                                      }
                                                    ? void
                                                    : T extends {
                                                          type: "stop_playlist";
                                                        }
                                                      ? void
                                                      : T extends {
                                                            type: "pause_playlist";
                                                          }
                                                        ? void
                                                        : T extends {
                                                              type: "resume_playlist";
                                                            }
                                                          ? void
                                                          : T extends {
                                                                type: "next_playlist_image";
                                                              }
                                                            ? void
                                                            : T extends {
                                                                  type: "previous_playlist_image";
                                                                }
                                                              ? void
                                                              : T extends {
                                                                    type: "get_active_playlists";
                                                                  }
                                                                ? ActivePlaylistInstance[]
                                                                : T extends {
                                                                      type: "get_active_playlist_for_monitor";
                                                                    }
                                                                  ? ActivePlaylistInstance | null
                                                                  : T extends {
                                                                        type: "stop_all_playlists";
                                                                      }
                                                                    ? void
                                                                    : T extends {
                                                                          type: "pause_all_playlists";
                                                                        }
                                                                      ? void
                                                                      : T extends {
                                                                            type: "resume_all_playlists";
                                                                          }
                                                                        ? void
                                                                        : T extends {
                                                                              type: "next_all_playlists";
                                                                            }
                                                                          ? void
                                                                          : T extends {
                                                                                type: "previous_all_playlists";
                                                                              }
                                                                            ? void
                                                                            : T extends {
                                                                                  type: "get_folders";
                                                                                }
                                                                              ? Folder[]
                                                                              : T extends {
                                                                                    type: "get_folder";
                                                                                  }
                                                                                ? Folder
                                                                                : T extends {
                                                                                      type: "get_folder_path";
                                                                                    }
                                                                                  ? Folder[]
                                                                                  : T extends {
                                                                                        type: "create_folder";
                                                                                      }
                                                                                    ? Folder
                                                                                    : T extends {
                                                                                          type: "update_folder";
                                                                                        }
                                                                                      ? Folder
                                                                                      : T extends {
                                                                                            type: "delete_folder";
                                                                                          }
                                                                                        ? void
                                                                                        : T extends {
                                                                                              type: "move_images_to_folder";
                                                                                            }
                                                                                          ? {
                                                                                              moved: number;
                                                                                            }
                                                                                          : T extends {
                                                                                                type: "get_monitors";
                                                                                              }
                                                                                            ? Monitor[]
                                                                                            : T extends {
                                                                                                  type: "get_monitor";
                                                                                                }
                                                                                              ? Monitor
                                                                                              : T extends {
                                                                                                    type: "get_config";
                                                                                                  }
                                                                                                ? UnifiedConfig
                                                                                                : T extends {
                                                                                                      type: "update_config";
                                                                                                    }
                                                                                                  ? UnifiedConfig
                                                                                                  : T extends {
                                                                                                        type: "get_config_section";
                                                                                                      }
                                                                                                    ? unknown
                                                                                                    : T extends {
                                                                                                          type: "update_config_section";
                                                                                                        }
                                                                                                      ? unknown
                                                                                                      : T extends {
                                                                                                            type: "get_backend_config";
                                                                                                          }
                                                                                                        ? unknown
                                                                                                        : T extends {
                                                                                                              type: "update_backend_config";
                                                                                                            }
                                                                                                          ? void
                                                                                                          : T extends {
                                                                                                                type: "get_backends";
                                                                                                              }
                                                                                                            ? BackendInfo[]
                                                                                                            : T extends {
                                                                                                                  type: "get_backend_capabilities";
                                                                                                                }
                                                                                                              ? BackendInfo
                                                                                                              : T extends {
                                                                                                                    type: "activate_backend";
                                                                                                                  }
                                                                                                                ? {
                                                                                                                    backend: string;
                                                                                                                    already_active: boolean;
                                                                                                                  }
                                                                                                                : never;
```

- [ ] **Step 3: Run the type test**

```bash
cd waypaper-engine && npx tsc --noEmit electron/ipc-types.test-types.ts 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 4: Delete the type test file**

```bash
rm waypaper-engine/electron/ipc-types.test-types.ts
```

- [ ] **Step 5: Commit**

```bash
git add electron/ipc-types.ts
git commit -m "feat(ipc): add typed DaemonRequest discriminated union and DaemonResponse<T> map in ipc-types.ts"
```

---

## Task 3: Update `IPCManager.ts` to dispatch on typed union

**Files:**

- Modify: `electron/managers/IPCManager.ts`

- [ ] **Step 1: Replace the `"go-daemon-command"` handler registration**

Find the existing handler block that registers `"go-daemon-command"` and replace it with `"daemon"`:

```typescript
// OLD (delete):
ipcMain.handle("go-daemon-command", async (event, action: string, payload?: unknown) => {
  switch (action) {
    case "ping": ...
    // ... all the string cases
  }
});

// NEW:
import type { DaemonRequest } from "../ipc-types";

ipcMain.handle("daemon", async (_event, req: DaemonRequest) => {
  switch (req.type) {
    case "ping":
      return goDaemonClient.health.ping();
    case "get_info":
      return goDaemonClient.health.getInfo();
    case "get_capabilities":
      return goDaemonClient.health.getCapabilities();
    case "shutdown":
      return goDaemonClient.health.shutdown();

    case "get_images":
      return goDaemonClient.images.getImages(req.params);
    case "get_image":
      return goDaemonClient.images.getImage(req.params.id);
    case "ensure_browser_preview":
      return goDaemonClient.images.ensureBrowserPreview(req.params.id, req.params.force);
    case "video_loop_export":
      return goDaemonClient.images.videoLoopExport(req.params.id, req.params.body);
    case "import_images":
      return goDaemonClient.images.importImages(req.params.paths, req.params.folder_id);
    case "import_web_wallpaper":
      return goDaemonClient.images.importWebWallpaper(req.params.path, req.params.folder_id);
    case "cancel_import":
      return goDaemonClient.images.cancelImport();
    case "delete_images":
      return goDaemonClient.images.deleteImages(req.params.ids);
    case "update_image":
      return goDaemonClient.images.updateImage(req.params.id, req.params.updates);
    case "select_all_images":
      return goDaemonClient.images.selectAll(req.params.selected);
    case "get_image_tags":
      return goDaemonClient.images.getTags();
    case "get_image_history":
      return goDaemonClient.wallpaper.getHistory(req.params);
    case "clear_image_history":
      return goDaemonClient.wallpaper.clearHistory();

    case "get_current_wallpapers":
      return goDaemonClient.wallpaper.getCurrent();
    case "set_wallpaper":
      return goDaemonClient.wallpaper.set(req.params);
    case "random_wallpaper":
      return goDaemonClient.wallpaper.random(req.params);

    case "get_playlists":
      return goDaemonClient.playlists.list();
    case "get_playlist":
      return goDaemonClient.playlists.get(req.params.id);
    case "create_playlist":
      return goDaemonClient.playlists.create(req.params);
    case "update_playlist":
      return goDaemonClient.playlists.update(req.params.id, req.params.updates);
    case "delete_playlist":
      return goDaemonClient.playlists.delete(req.params.id);
    case "start_playlist":
      return goDaemonClient.playlists.start(req.params.id, req.params.monitor, req.params.mode);
    case "stop_playlist":
      return goDaemonClient.playlists.stop(req.params.id);
    case "pause_playlist":
      return goDaemonClient.playlists.pause(req.params.id);
    case "resume_playlist":
      return goDaemonClient.playlists.resume(req.params.id);
    case "next_playlist_image":
      return goDaemonClient.playlists.next(req.params.id);
    case "previous_playlist_image":
      return goDaemonClient.playlists.previous(req.params.id);
    case "get_active_playlists":
      return goDaemonClient.playlists.listActive();
    case "get_active_playlist_for_monitor":
      return goDaemonClient.playlists.getActiveByMonitor(req.params.monitor);
    case "stop_all_playlists":
      return goDaemonClient.playlists.stopAll();
    case "pause_all_playlists":
      return goDaemonClient.playlists.pauseAll();
    case "resume_all_playlists":
      return goDaemonClient.playlists.resumeAll();
    case "next_all_playlists":
      return goDaemonClient.playlists.nextAll();
    case "previous_all_playlists":
      return goDaemonClient.playlists.previousAll();

    case "get_folders":
      return goDaemonClient.folders.list();
    case "get_folder":
      return goDaemonClient.folders.get(req.params.id);
    case "get_folder_path":
      return goDaemonClient.folders.getPath(req.params.id);
    case "create_folder":
      return goDaemonClient.folders.create(req.params);
    case "update_folder":
      return goDaemonClient.folders.update(req.params.id, req.params.name);
    case "delete_folder":
      return goDaemonClient.folders.delete(req.params.id);
    case "move_images_to_folder":
      return goDaemonClient.folders.moveImages(req.params);

    case "get_monitors":
      return goDaemonClient.monitors.list();
    case "get_monitor":
      return goDaemonClient.monitors.get(req.params.name);

    case "get_config":
      return goDaemonClient.control.getConfig();
    case "update_config":
      return goDaemonClient.control.updateConfig(req.params);
    case "get_config_section":
      return goDaemonClient.control.getConfigSection(req.params.section);
    case "update_config_section":
      return goDaemonClient.control.updateConfigSection(req.params.section, req.params.data);
    case "get_backend_config":
      return goDaemonClient.control.getBackendConfig(req.params.name);
    case "update_backend_config":
      return goDaemonClient.control.updateBackendConfig(req.params.name, req.params.patch);

    case "get_backends":
      return goDaemonClient.control.listBackends();
    case "get_backend_capabilities":
      return goDaemonClient.control.getBackendCapabilities(req.params.name);
    case "activate_backend":
      return goDaemonClient.control.activateBackend(req.params.name);

    default: {
      const _exhaustive: never = req;
      throw new Error(`unknown daemon request type: ${(_exhaustive as DaemonRequest).type}`);
    }
  }
});
```

Note: the `default: never` exhaustiveness check means TypeScript will error at compile time if a new `DaemonRequest` variant is added without a corresponding case.

- [ ] **Step 2: Remove dead cases**

The following cases that were in the old switch must NOT appear in the new switch:

- `"get_image_count"` — deleted route
- `"rename_image"` — deleted route (folded into `update_image`)

- [ ] **Step 3: Delete `ipcEnvelope.ts`**

```bash
rm waypaper-engine/electron/ipcEnvelope.ts
```

Remove the import from `preload.ts` in the next task.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd waypaper-engine && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add electron/managers/IPCManager.ts && git rm electron/ipcEnvelope.ts
git commit -m "refactor(ipc): replace string-dispatch go-daemon-command with typed 'daemon' channel; exhaustive switch on DaemonRequest.type; delete ipcEnvelope.ts"
```

---

## Task 4: Update `preload.ts` to use the typed `"daemon"` channel

**Files:**

- Modify: `electron/preload.ts`

- [ ] **Step 1: Replace `invokeWrapped` and all `ipcRenderer.invoke("go-daemon-command", ...)` calls**

At the top of `preload.ts`, delete the `unwrapIPCResponse` import and the `invokeWrapped` helper. Add a typed invoke helper:

```typescript
import type { DaemonRequest, DaemonResponse } from "./ipc-types";
import { ipcRenderer, contextBridge, webUtils } from "electron";

function invoke<T extends DaemonRequest>(req: T): Promise<DaemonResponse<T>> {
  return ipcRenderer.invoke("daemon", req) as Promise<DaemonResponse<T>>;
}
```

- [ ] **Step 2: Replace every `ipcRenderer.invoke("go-daemon-command", action, payload)` with `invoke({type: action, params: payload})`**

Example transformations (apply to all methods in the `goDaemon` block):

```typescript
// OLD:
ping: (): Promise<boolean> => ipcRenderer.invoke("go-daemon-command", "ping"),

// NEW:
ping: (): Promise<boolean> => invoke({ type: "ping" }),
```

```typescript
// OLD:
getImages: (params?: ImageQueryParams): Promise<PaginatedResponse<Image>> =>
  ipcRenderer.invoke("go-daemon-command", "get_images", params),

// NEW:
getImages: (params?: ImageQueryParams): Promise<PaginatedResponse<Image>> =>
  invoke({ type: "get_images", params: params ?? {} }),
```

```typescript
// OLD:
setWallpaper: (imageId: number, monitor?: string, mode?: string) =>
  ipcRenderer.invoke("go-daemon-command", "set_wallpaper", { image_id: imageId, monitor, mode }),

// NEW:
setWallpaper: (imageId: number, monitor?: string, mode?: string) =>
  invoke({ type: "set_wallpaper", params: { image_id: imageId, monitor, mode } }),
```

Apply this pattern exhaustively to all methods. Remove methods for deleted routes:

- Remove `getImageCount`
- Remove `renameImage`

- [ ] **Step 3: Update `on` / event subscription — keep using `ipcRenderer.on` for SSE forwarding**

The `goDaemon.on` method in preload listens to renderer-bound IPC events forwarded from main. This pattern does not change — it stays as `ipcRenderer.on("go-daemon-event-" + event, callback)`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd waypaper-engine && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add electron/preload.ts
git commit -m "refactor(preload): typed invoke<T extends DaemonRequest> replaces string-based ipcRenderer.invoke; remove deleted-route bindings"
```

---

## Task 5: Create renderer-side `daemonClient` singleton

**Files:**

- Create: `src/client/daemonClient.ts`
- Create: `src/client/index.ts`
- Create: `src/test/mocks/daemonClient.ts`

- [ ] **Step 1: Write a failing import test**

Add to any existing test file temporarily:

```typescript
import { daemonClient } from "@/client";
```

```bash
cd waypaper-engine && npx tsc --noEmit 2>&1 | grep "client"
```

Expected: `Cannot find module '@/client'`

- [ ] **Step 2: Create `src/client/daemonClient.ts`**

```typescript
// daemonClient is the single seam between React and the Electron preload.
// All stores and hooks call this module — never window.API_RENDERER.goDaemon directly.
//
// Initialized at module load time. window.API_RENDERER is guaranteed to exist
// before any React module runs in the Electron renderer context.

import type {
  Image,
  ImageQueryParams,
  PaginatedResponse,
  ImportImagesParams,
  SetWallpaperParams,
  Playlist,
  CreatePlaylistParams,
  Folder,
  CreateFolderParams,
  MoveImagesParams,
  Monitor,
  UnifiedConfig,
  BackendInfo,
  DaemonInfo,
  WallpaperCurrent,
  ActivePlaylistInstance,
  ImageHistoryEntry,
  VideoLoopExportRequest,
  VideoLoopExportResult,
} from "../../electron/ipc-types";

type EventType = Parameters<typeof window.API_RENDERER.goDaemon.on>[0];
type EventCallback = Parameters<typeof window.API_RENDERER.goDaemon.on>[1];

function gd() {
  return window.API_RENDERER.goDaemon;
}

export const daemonClient = {
  // Health
  ping: (): Promise<boolean> => gd().ping(),
  getInfo: (): Promise<DaemonInfo> => gd().getInfo(),
  getCapabilities: (): Promise<{ ffmpeg_available: boolean }> =>
    gd().getCapabilities(),
  shutdown: (): Promise<void> => gd().shutdown(),

  // Images
  getImages: (params?: ImageQueryParams): Promise<PaginatedResponse<Image>> =>
    gd().getImages(params),
  getImage: (id: number): Promise<Image> => gd().getImage(id),
  importImages: (
    paths: string[],
    folderID?: number,
  ): Promise<{ status: string; total: number }> =>
    gd().importImages(paths, folderID),
  importWebWallpaper: (path: string, folderID?: number) =>
    gd().importWebWallpaper(path, folderID),
  cancelImport: (): Promise<void> => gd().cancelImport(),
  deleteImages: (ids: number[]): Promise<{ deleted: number }> =>
    gd().deleteImages(ids),
  updateImage: (id: number, updates: Record<string, unknown>): Promise<Image> =>
    gd().updateImage(id, updates),
  selectAllImages: (selected: boolean) => gd().selectAllImages(selected),
  getImageTags: (): Promise<{ tags: string[] }> => gd().getImageTags(),
  getImageHistory: (params?: {
    monitor?: string;
    limit?: number;
  }): Promise<ImageHistoryEntry[]> => gd().getImageHistory(params),
  clearImageHistory: (): Promise<void> => gd().clearImageHistory(),
  ensureBrowserPreview: (id: number, force?: boolean): Promise<Image> =>
    gd().ensureBrowserPreview(id, force),
  videoLoopExport: (
    id: number,
    body: VideoLoopExportRequest,
  ): Promise<VideoLoopExportResult> => gd().videoLoopExport(id, body),

  // Wallpaper
  getCurrentWallpapers: (): Promise<WallpaperCurrent> =>
    gd().getCurrentWallpapers(),
  setWallpaper: (imageId: number, monitor?: string, mode?: string) =>
    gd().setWallpaper(imageId, monitor, mode),
  setRandomWallpaper: (monitor?: string, mode?: string) =>
    gd().setRandomWallpaper(monitor, mode),

  // Playlists
  getPlaylists: (): Promise<Playlist[]> => gd().getPlaylists(),
  getPlaylist: (id: number): Promise<Playlist> => gd().getPlaylist(id),
  createPlaylist: (params: CreatePlaylistParams): Promise<Playlist> =>
    gd().createPlaylist(params),
  updatePlaylist: (id: number, updates: Partial<Playlist>): Promise<Playlist> =>
    gd().updatePlaylist(id, updates),
  deletePlaylist: (id: number): Promise<void> => gd().deletePlaylist(id),
  startPlaylist: (id: number, monitor?: string, mode?: string): Promise<void> =>
    gd().startPlaylist(id, monitor, mode),
  stopPlaylist: (id: number): Promise<void> => gd().stopPlaylist(id),
  pausePlaylist: (id: number): Promise<void> => gd().pausePlaylist(id),
  resumePlaylist: (id: number): Promise<void> => gd().resumePlaylist(id),
  nextPlaylistImage: (id: number): Promise<void> => gd().nextPlaylistImage(id),
  previousPlaylistImage: (id: number): Promise<void> =>
    gd().previousPlaylistImage(id),
  getActivePlaylists: (): Promise<ActivePlaylistInstance[]> =>
    gd().getActivePlaylists(),
  getActivePlaylistForMonitor: (
    monitor: string,
  ): Promise<ActivePlaylistInstance | null> =>
    gd().getActivePlaylistForMonitor(monitor),
  stopAllPlaylists: (): Promise<void> => gd().stopAllPlaylists(),
  pauseAllPlaylists: (): Promise<void> => gd().pauseAllPlaylists(),
  resumeAllPlaylists: (): Promise<void> => gd().resumeAllPlaylists(),
  nextAllPlaylists: (): Promise<void> => gd().nextAllPlaylists(),
  previousAllPlaylists: (): Promise<void> => gd().previousAllPlaylists(),

  // Folders
  getFolders: (): Promise<Folder[]> => gd().getFolders(),
  getFolder: (id: number): Promise<Folder> => gd().getFolder(id),
  getFolderPath: (id: number): Promise<Folder[]> => gd().getFolderPath(id),
  createFolder: (params: CreateFolderParams): Promise<Folder> =>
    gd().createFolder(params),
  updateFolder: (id: number, name: string): Promise<Folder> =>
    gd().updateFolder(id, name),
  deleteFolder: (id: number): Promise<void> => gd().deleteFolder(id),
  moveImagesToFolder: (params: MoveImagesParams) =>
    gd().moveImagesToFolder(params),

  // Monitors
  getMonitors: (): Promise<Monitor[]> => gd().getMonitors(),
  getMonitor: (name: string): Promise<Monitor> => gd().getMonitor(name),

  // Config
  getConfig: (): Promise<UnifiedConfig> => gd().getConfig(),
  updateConfig: (data: Record<string, unknown>): Promise<UnifiedConfig> =>
    gd().updateConfig(data),
  getConfigSection: (section: string): Promise<unknown> =>
    gd().getConfigSection(section),
  updateConfigSection: (
    section: string,
    data: Record<string, unknown>,
  ): Promise<unknown> => gd().updateConfigSection(section, data),
  getBackendConfig: (name: string): Promise<unknown> =>
    gd().getBackendConfig(name),
  updateBackendConfig: (
    name: string,
    patch: Record<string, unknown>,
  ): Promise<void> => gd().updateBackendConfig(name, patch),

  // Backends
  getBackends: (): Promise<BackendInfo[]> => gd().getBackends(),
  getBackendCapabilities: (name: string): Promise<BackendInfo> =>
    gd().getBackendCapabilities(name),
  activateBackend: (name: string) => gd().activateBackend(name),

  // SSE event subscriptions
  on: (event: EventType, callback: EventCallback): (() => void) =>
    gd().on(event, callback),
} as const;

export type DaemonClient = typeof daemonClient;
```

- [ ] **Step 3: Create `src/client/index.ts`**

```typescript
export { daemonClient } from "./daemonClient";
export type { DaemonClient } from "./daemonClient";
```

- [ ] **Step 4: Create `src/test/mocks/daemonClient.ts`**

```typescript
import { vi } from "vitest";
import type { DaemonClient } from "@/client";

export const mockDaemonClient: DaemonClient = {
  ping: vi.fn().mockResolvedValue(true),
  getInfo: vi.fn().mockResolvedValue({ version: "test", backend: "mock" }),
  getCapabilities: vi.fn().mockResolvedValue({ ffmpeg_available: true }),
  shutdown: vi.fn().mockResolvedValue(undefined),

  getImages: vi
    .fn()
    .mockResolvedValue({ items: [], total: 0, page: 1, per_page: 20 }),
  getImage: vi.fn().mockResolvedValue(null),
  importImages: vi.fn().mockResolvedValue({ status: "ok", total: 0 }),
  importWebWallpaper: vi.fn().mockResolvedValue({ status: "ok" }),
  cancelImport: vi.fn().mockResolvedValue(undefined),
  deleteImages: vi.fn().mockResolvedValue({ deleted: 0 }),
  updateImage: vi.fn().mockResolvedValue(null),
  selectAllImages: vi.fn().mockResolvedValue(undefined),
  getImageTags: vi.fn().mockResolvedValue({ tags: [] }),
  getImageHistory: vi.fn().mockResolvedValue([]),
  clearImageHistory: vi.fn().mockResolvedValue(undefined),
  ensureBrowserPreview: vi.fn().mockResolvedValue(null),
  videoLoopExport: vi.fn().mockResolvedValue({ image_id: 0, path: "" }),

  getCurrentWallpapers: vi.fn().mockResolvedValue(null),
  setWallpaper: vi.fn().mockResolvedValue({ status: "ok", image_id: 0 }),
  setRandomWallpaper: vi.fn().mockResolvedValue({ status: "ok", image_id: 0 }),

  getPlaylists: vi.fn().mockResolvedValue([]),
  getPlaylist: vi.fn().mockResolvedValue(null),
  createPlaylist: vi.fn().mockResolvedValue(null),
  updatePlaylist: vi.fn().mockResolvedValue(null),
  deletePlaylist: vi.fn().mockResolvedValue(undefined),
  startPlaylist: vi.fn().mockResolvedValue(undefined),
  stopPlaylist: vi.fn().mockResolvedValue(undefined),
  pausePlaylist: vi.fn().mockResolvedValue(undefined),
  resumePlaylist: vi.fn().mockResolvedValue(undefined),
  nextPlaylistImage: vi.fn().mockResolvedValue(undefined),
  previousPlaylistImage: vi.fn().mockResolvedValue(undefined),
  getActivePlaylists: vi.fn().mockResolvedValue([]),
  getActivePlaylistForMonitor: vi.fn().mockResolvedValue(null),
  stopAllPlaylists: vi.fn().mockResolvedValue(undefined),
  pauseAllPlaylists: vi.fn().mockResolvedValue(undefined),
  resumeAllPlaylists: vi.fn().mockResolvedValue(undefined),
  nextAllPlaylists: vi.fn().mockResolvedValue(undefined),
  previousAllPlaylists: vi.fn().mockResolvedValue(undefined),

  getFolders: vi.fn().mockResolvedValue([]),
  getFolder: vi.fn().mockResolvedValue(null),
  getFolderPath: vi.fn().mockResolvedValue([]),
  createFolder: vi.fn().mockResolvedValue(null),
  updateFolder: vi.fn().mockResolvedValue(null),
  deleteFolder: vi.fn().mockResolvedValue(undefined),
  moveImagesToFolder: vi.fn().mockResolvedValue({ moved: 0 }),

  getMonitors: vi.fn().mockResolvedValue([]),
  getMonitor: vi.fn().mockResolvedValue(null),

  getConfig: vi.fn().mockResolvedValue({}),
  updateConfig: vi.fn().mockResolvedValue({}),
  getConfigSection: vi.fn().mockResolvedValue({}),
  updateConfigSection: vi.fn().mockResolvedValue({}),
  getBackendConfig: vi.fn().mockResolvedValue({}),
  updateBackendConfig: vi.fn().mockResolvedValue(undefined),

  getBackends: vi.fn().mockResolvedValue([]),
  getBackendCapabilities: vi.fn().mockResolvedValue(null),
  activateBackend: vi
    .fn()
    .mockResolvedValue({ backend: "mock", already_active: false }),

  on: vi.fn().mockReturnValue(() => {}),
};
```

- [ ] **Step 5: Verify the singleton compiles**

```bash
cd waypaper-engine && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/client/ src/test/mocks/daemonClient.ts
git commit -m "feat(client): add renderer-side daemonClient singleton and mockDaemonClient for tests"
```

---

## Task 6: Migrate stores and hooks from `window.API_RENDERER.goDaemon` to `daemonClient`

**Files:**

- Modify: `src/stores/images.ts`
- Modify: `src/stores/historyStore.ts`
- Modify: `src/stores/settingsStore.ts`
- Modify: `src/stores/wallhavenStore.ts`
- Modify: `src/stores/playlist.ts`
- Modify: `src/stores/foldersStore.ts`
- Modify: `src/stores/monitors.ts`
- Modify: `src/stores/activePlaylistStore.ts`
- Modify: `src/hooks/useRealTimeImageProcessing.tsx`
- Modify: `src/hooks/useNotifications.ts`
- Modify: `src/hooks/useLoadAppConfig.ts`
- Modify: `src/hooks/useLoadMonitors.ts`
- Modify: any other hook or component calling `window.API_RENDERER.goDaemon.*`

- [ ] **Step 1: Global search for all direct `window.API_RENDERER.goDaemon` calls in `src/`**

```bash
grep -rn "window\.API_RENDERER\.goDaemon\|API_RENDERER\.goDaemon" waypaper-engine/src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__" | grep -v "\.d\.ts"
```

Save the output — every line is a call site to migrate.

- [ ] **Step 2: Migrate `src/stores/images.ts`**

Replace:

```typescript
const { goDaemon } = window.API_RENDERER;
```

With:

```typescript
import { daemonClient } from "@/client";
```

Replace every `goDaemon.X(...)` call with `daemonClient.X(...)`.

- [ ] **Step 3: Migrate `src/stores/historyStore.ts`**

Same pattern as Step 2. Replace `const { goDaemon } = window.API_RENDERER;` with the import, then replace all calls.

- [ ] **Step 4: Migrate `src/stores/settingsStore.ts`**

This store has several `window.API_RENDERER?.goDaemon?.X` optional chain calls. Replace each:

```typescript
// OLD:
if (window.API_RENDERER?.goDaemon?.getConfig) {
  const incoming = await window.API_RENDERER.goDaemon.getConfig();
// NEW:
const incoming = await daemonClient.getConfig();
```

Remove the optional-chain guards — `daemonClient` is always initialized at module load, so guard checks are unnecessary.

- [ ] **Step 5: Migrate `src/stores/wallhavenStore.ts`**

Note: `wallhavenStore` calls both `window.API_RENDERER.goDaemon.*` (migrated to `daemonClient`) AND `window.API_RENDERER.wallhaven.*` (stays as-is — wallhaven is not a daemon concern).

- [ ] **Step 6: Migrate all remaining stores**

Repeat Step 2 pattern for: `playlist.ts`, `foldersStore.ts`, `monitors.ts`, `activePlaylistStore.ts`, and any others found in Step 1.

- [ ] **Step 7: Migrate hooks**

Replace `window.API_RENDERER.goDaemon.on(event, callback)` with `daemonClient.on(event, callback)` in:

- `src/hooks/useRealTimeImageProcessing.tsx`
- `src/hooks/useNotifications.ts`
- Any other hook using `goDaemon.on`

Replace `window.API_RENDERER.goDaemon.X()` with `daemonClient.X()` in:

- `src/hooks/useLoadAppConfig.ts`
- `src/hooks/useLoadMonitors.ts`
- Any other hook using `goDaemon.*`

- [ ] **Step 8: Migrate component call sites**

```bash
grep -rn "window\.API_RENDERER\.goDaemon" waypaper-engine/src/components/ waypaper-engine/src/routes/ waypaper-engine/src/utils/ --include="*.ts" --include="*.tsx"
```

Apply the same migration to every result.

- [ ] **Step 9: Update existing store tests to use `mockDaemonClient`**

In `src/stores/__tests__/`, existing tests mock `window.API_RENDERER`. Update them to instead import and use `mockDaemonClient`:

```typescript
// In test setup (vitest.setup.ts or per-test beforeEach):
import { mockDaemonClient } from "@/test/mocks/daemonClient";
import * as clientModule from "@/client";

vi.spyOn(clientModule, "daemonClient", "get").mockReturnValue(mockDaemonClient);
```

Or if the store imports `daemonClient` at module level, use `vi.mock("@/client", ...)`:

```typescript
vi.mock("@/client", () => ({
  daemonClient: mockDaemonClient,
}));
```

- [ ] **Step 10: Verify no remaining `window.API_RENDERER.goDaemon` calls in `src/`**

```bash
grep -rn "API_RENDERER\.goDaemon" waypaper-engine/src/ --include="*.ts" --include="*.tsx" | grep -v "\.d\.ts"
```

Expected: zero results (only `src/types/electron.d.ts` may reference the type — that is fine).

- [ ] **Step 11: Run all frontend tests**

```bash
cd waypaper-engine && npm test
```

Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add src/stores/ src/hooks/ src/components/ src/routes/ src/utils/
git commit -m "refactor(renderer): migrate all window.API_RENDERER.goDaemon.* calls to daemonClient singleton; update store tests to use mockDaemonClient"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run full CI check**

```bash
cd waypaper-engine && npm run ci:check
```

Expected: all checks pass.

- [ ] **Step 2: Verify generated types stay fresh after a daemon rebuild**

```bash
cd waypaper-engine && npm run build:daemon && git diff -- electron/daemon-go-types.generated.ts
```

Expected: no diff (generated file matches committed version).

- [ ] **Step 3: Run CI types check (ensures no drift)**

```bash
cd waypaper-engine && npm run ci:types
```

Expected: exits 0.

- [ ] **Step 4: Start dev server and manually verify the gallery loads**

```bash
cd waypaper-engine && npm run dev
```

Open the app. Confirm: gallery loads, wallpaper can be set, playlists work, settings open without errors.

- [ ] **Step 5: Final commit**

```bash
git add -p
git commit -m "chore: final CI fixups for frontend IPC architecture refactor"
```
