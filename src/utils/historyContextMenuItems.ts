import type { MenuItem } from "../stores/contextMenuStore";
import type { ImageHistoryEntry, Monitor } from "../../electron/daemon-go-types";
import { useHistoryStore } from "../stores/historyStore";
import { notifyWallpaperApplyFailed } from "./daemonUserFacingError";
import { buildWallpaperSubmenu, buildClearHistoryItem } from "./sharedContextMenuHelpers";
import { daemonClient } from "@/client";

export function buildHistoryEntryMenuItems(
  entry: ImageHistoryEntry,
  monitors: Monitor[],
): MenuItem[] {
  const modeLabel =
    entry.mode === "extend" ? "Extend" : entry.mode === "clone" ? "Clone" : "Individual";
  const monitorsLabel = entry.monitors.join(", ");

  return [
    {
      type: "submenu",
      label: `Set "${entry.image_name}"`,
      children: buildWallpaperSubmenu(
        monitors,
        (monitor, mode) => {
          void daemonClient
            .setWallpaper(entry.image_id, monitor, mode)
            .catch(notifyWallpaperApplyFailed);
        },
        [
          {
            type: "action",
            label: `Restore original (${modeLabel} on ${monitorsLabel})`,
            onClick: () => {
              void daemonClient
                .setWallpaper(entry.image_id, undefined, entry.mode, entry.monitors)
                .catch(notifyWallpaperApplyFailed);
            },
          },
          { type: "separator" },
        ],
      ),
    },
    {
      type: "action",
      label: "Copy image name",
      onClick: () => {
        void navigator.clipboard.writeText(entry.image_name);
      },
    },
    { type: "separator" },
    buildClearHistoryItem(
      () => void useHistoryStore.getState().clearHistory(),
      "Clear all history",
    ),
  ];
}
