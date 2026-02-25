import type { MenuItem } from "../stores/contextMenuStore";
import type { Monitor, MonitorMode } from "../../electron/daemon-go-types";
import { confirmDialog } from "../components/ConfirmDialog";

/**
 * Builds the common "set wallpaper" submenu: duplicate/extend across all
 * monitors plus one entry per individual monitor.
 *
 * @param prefixItems  Optional items placed before the standard entries
 *                     (e.g. "Restore original" in the history menu).
 */
export function buildWallpaperSubmenu(
  monitors: Monitor[],
  onSet: (monitor: string, mode: MonitorMode) => void,
  prefixItems?: MenuItem[],
): MenuItem[] {
  const items: MenuItem[] = [];

  if (prefixItems?.length) {
    items.push(...prefixItems);
  }

  items.push(
    {
      type: "action",
      label: "Duplicate across all monitors",
      onClick: () => onSet("*", "clone"),
    },
    {
      type: "action",
      label: "Extend across all monitors",
      onClick: () => onSet("*", "extend"),
    },
  );

  if (monitors.length > 0) {
    items.push({ type: "separator" });
    for (const monitor of monitors) {
      items.push({
        type: "action",
        label: `On ${monitor.name}`,
        onClick: () => onSet(monitor.name, "individual"),
      });
    }
  }

  return items;
}

export function buildClearHistoryItem(
  onClear: () => void,
  label = "Clear wallpaper history",
): MenuItem {
  return {
    type: "action",
    label,
    danger: true,
    onClick: async () => {
      const confirmed = await confirmDialog({
        title: "Clear wallpaper history",
        message: "Are you sure you want to delete all wallpaper history? This cannot be undone.",
        confirmLabel: "Clear all",
        danger: true,
      });
      if (confirmed) onClear();
    },
  };
}
