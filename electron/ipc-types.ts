/**
 * Typed IPC contract for the "go-daemon-command" channel.
 *
 * DaemonRequest — discriminated union of every action exposed through the
 * goDaemon object in preload.ts.
 *
 * DaemonResponse<T> — maps each request variant to its return type.
 *
 * Wire types come from ./daemon-go-types (hand-maintained, authoritative).
 *
 * Excluded (routes deleted from daemon):
 *   - get_image_count
 *   - rename_image
 */

export type {
  Image,
  ImageQueryParams,
  PaginatedResponse,
  ImageHistoryEntry,
  UpdateImageRequest,
  Playlist,
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
  ActivePlaylistInstance,
  Monitor,
  UnifiedConfig,
  BackendInfo,
  BackendCapabilities,
  DaemonInfo,
  MonitorMode,
  WallpaperCurrent,
  Folder,
  VideoLoopExportRequest,
  VideoLoopExportResult,
} from "./daemon-go-types";

import type {
  Image,
  ImageQueryParams,
  PaginatedResponse,
  ImageHistoryEntry,
  UpdateImageRequest,
  Playlist,
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
  ActivePlaylistInstance,
  Monitor,
  UnifiedConfig,
  BackendInfo,
  BackendCapabilities,
  DaemonInfo,
  WallpaperCurrent,
  MonitorMode,
  Folder,
  VideoLoopExportRequest,
  VideoLoopExportResult,
} from "./daemon-go-types";

// ---------------------------------------------------------------------------
// DaemonRequest — discriminated union
// ---------------------------------------------------------------------------

export type DaemonRequest =
  // HEALTH & SYSTEM
  | { type: "ping" }
  | { type: "get_info" }
  | { type: "get_capabilities" }
  | { type: "shutdown" }

  // IMAGES
  | { type: "get_images"; params?: ImageQueryParams }
  | { type: "get_image"; id: number }
  | { type: "ensure_browser_preview"; id: number; force?: boolean }
  | { type: "video_loop_export"; id: number; body: VideoLoopExportRequest }
  | { type: "import_images"; paths: string[]; folder_id?: number | null }
  | { type: "import_web_wallpaper"; path: string; folder_id?: number | null }
  | { type: "cancel_import"; batch_id: string }
  | { type: "delete_images"; ids: number[] }
  | { type: "update_image"; id: number; update: UpdateImageRequest }
  | { type: "select_all_images"; selected: boolean }
  | { type: "get_image_tags" }
  | { type: "get_image_history"; limit?: number; monitor?: string }
  | { type: "clear_image_history" }

  // WALLPAPER
  | { type: "get_current_wallpapers" }
  | {
      type: "set_wallpaper";
      image_id: number;
      monitor?: string;
      mode?: MonitorMode;
      monitors?: string[];
    }
  | { type: "random_wallpaper"; monitor?: string; mode?: MonitorMode }

  // PLAYLISTS
  | { type: "get_playlists" }
  | { type: "get_playlist"; id: number }
  | { type: "create_playlist"; playlist: CreatePlaylistRequest }
  | { type: "update_playlist"; id: number; update: UpdatePlaylistRequest }
  | { type: "delete_playlist"; id: number }
  | { type: "start_playlist"; id: number; monitor?: string; mode?: MonitorMode }
  | { type: "stop_playlist"; id: number }
  | { type: "pause_playlist"; id: number }
  | { type: "resume_playlist"; id: number }
  | { type: "next_playlist_image"; id: number }
  | { type: "previous_playlist_image"; id: number }
  | { type: "get_active_playlists" }
  | { type: "get_active_playlist_for_monitor"; monitor: string }
  | { type: "stop_all_playlists" }

  // FOLDERS
  | { type: "get_folders"; parent_id?: number | null; search?: string }
  | { type: "get_folder"; id: number }
  | { type: "get_folder_path"; id: number }
  | { type: "create_folder"; name: string; parent_id?: number | null }
  | {
      type: "update_folder";
      id: number;
      update: { name?: string; parent_id?: number | null };
    }
  | { type: "delete_folder"; id: number; mode?: "keep_contents" | "delete_all" }
  | {
      type: "move_images_to_folder";
      image_ids: number[];
      folder_id: number | null;
    }

  // MONITORS
  | { type: "get_monitors" }
  | { type: "get_monitor"; name: string }

  // CONFIG
  | { type: "get_config" }
  | { type: "update_config"; config: Partial<UnifiedConfig> }
  | { type: "get_config_section"; section: string }
  | {
      type: "update_config_section";
      section: string;
      data: Record<string, unknown>;
    }
  | { type: "get_backend_config"; name: string }
  | {
      type: "update_backend_config";
      name: string;
      patch: Record<string, unknown>;
    }

  // BACKENDS
  | { type: "get_backends" }
  | { type: "get_backend_capabilities" }
  | { type: "activate_backend"; name: string };

// ---------------------------------------------------------------------------
// DaemonResponse<T> — maps each request type to its return type
// ---------------------------------------------------------------------------

export type DaemonResponse<T extends DaemonRequest> =
  // HEALTH & SYSTEM
  T extends { type: "ping" }
    ? boolean
    : T extends { type: "get_info" }
      ? DaemonInfo
      : T extends { type: "get_capabilities" }
        ? { ffmpeg_available: boolean }
        : T extends { type: "shutdown" }
          ? void
          : // IMAGES
            T extends { type: "get_images" }
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
                      ? Image
                      : T extends { type: "cancel_import" }
                        ? { status: string; batch_id: string }
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
                                    ? { status: string }
                                    : // WALLPAPER
                                      T extends {
                                          type: "get_current_wallpapers";
                                        }
                                      ? WallpaperCurrent
                                      : T extends { type: "set_wallpaper" }
                                        ? {
                                            status: string;
                                            image_id: number;
                                            monitor: string;
                                            mode: string;
                                          }
                                        : T extends { type: "random_wallpaper" }
                                          ? {
                                              status: string;
                                              image_id: number;
                                              monitor: string;
                                              mode: string;
                                            }
                                          : // PLAYLISTS
                                            T extends { type: "get_playlists" }
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
                                                                    ? ActivePlaylistInstance
                                                                    : T extends {
                                                                          type: "stop_all_playlists";
                                                                        }
                                                                      ? void
                                                                      : // FOLDERS
                                                                        T extends {
                                                                            type: "get_folders";
                                                                          }
                                                                        ? {
                                                                            data: Folder[];
                                                                          }
                                                                        : T extends {
                                                                              type: "get_folder";
                                                                            }
                                                                          ? Folder
                                                                          : T extends {
                                                                                type: "get_folder_path";
                                                                              }
                                                                            ? {
                                                                                data: Folder[];
                                                                              }
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
                                                                                  ? {
                                                                                      deleted: boolean;
                                                                                      mode: string;
                                                                                    }
                                                                                  : T extends {
                                                                                        type: "move_images_to_folder";
                                                                                      }
                                                                                    ? {
                                                                                        moved: number;
                                                                                      }
                                                                                    : // MONITORS
                                                                                      T extends {
                                                                                          type: "get_monitors";
                                                                                        }
                                                                                      ? Monitor[]
                                                                                      : T extends {
                                                                                            type: "get_monitor";
                                                                                          }
                                                                                        ? Monitor
                                                                                        : // CONFIG
                                                                                          T extends {
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
                                                                                                  ? Record<
                                                                                                      string,
                                                                                                      unknown
                                                                                                    >
                                                                                                  : T extends {
                                                                                                        type: "update_backend_config";
                                                                                                      }
                                                                                                    ? void
                                                                                                    : // BACKENDS
                                                                                                      T extends {
                                                                                                          type: "get_backends";
                                                                                                        }
                                                                                                      ? BackendInfo[]
                                                                                                      : T extends {
                                                                                                            type: "get_backend_capabilities";
                                                                                                          }
                                                                                                        ? BackendCapabilities | null
                                                                                                        : T extends {
                                                                                                              type: "activate_backend";
                                                                                                            }
                                                                                                          ? {
                                                                                                              status: string;
                                                                                                              backend: string;
                                                                                                            }
                                                                                                          : never;
