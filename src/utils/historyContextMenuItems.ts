import type { MenuItem } from "../stores/contextMenuStore";
import type { ImageHistoryEntry, Monitor } from "../../electron/daemon-go-types";
import { useHistoryStore } from "../stores/historyStore";
import { confirmDialog } from "../components/ConfirmDialog";

const { goDaemon } = window.API_RENDERER;

function wallpaperSubmenu(
	entry: ImageHistoryEntry,
	monitors: Monitor[],
): MenuItem[] {
	const modeLabel =
		entry.mode === "extend"
			? "Extend"
			: entry.mode === "clone"
				? "Clone"
				: "Individual";
	const monitorsLabel = entry.monitors.join(", ");

	const items: MenuItem[] = [
		{
			type: "action",
			label: `Restore original (${modeLabel} on ${monitorsLabel})`,
			onClick: () => {
				void goDaemon.setWallpaper(
					entry.image_id,
					undefined,
					entry.mode,
					entry.monitors,
				);
			},
		},
		{ type: "separator" },
		{
			type: "action",
			label: "Duplicate across all monitors",
			onClick: () => {
				void goDaemon.setWallpaper(entry.image_id, "*", "clone");
			},
		},
		{
			type: "action",
			label: "Extend across all monitors",
			onClick: () => {
				void goDaemon.setWallpaper(entry.image_id, "*", "extend");
			},
		},
	];

	if (monitors.length > 0) {
		items.push({ type: "separator" });
		for (const monitor of monitors) {
			items.push({
				type: "action",
				label: `On ${monitor.name}`,
				onClick: () => {
					void goDaemon.setWallpaper(
						entry.image_id,
						monitor.name,
						"individual",
					);
				},
			});
		}
	}

	return items;
}

export function buildHistoryEntryMenuItems(
	entry: ImageHistoryEntry,
	monitors: Monitor[],
): MenuItem[] {
	return [
		{
			type: "submenu",
			label: `Set "${entry.image_name}"`,
			children: wallpaperSubmenu(entry, monitors),
		},
		{
			type: "action",
			label: "Copy image name",
			onClick: () => {
				void navigator.clipboard.writeText(entry.image_name);
			},
		},
		{ type: "separator" },
		{
			type: "action",
			label: "Clear all history",
			danger: true,
			onClick: async () => {
				const confirmed = await confirmDialog({
					title: "Clear wallpaper history",
					message:
						"Are you sure you want to delete all wallpaper history? This cannot be undone.",
					confirmLabel: "Clear all",
					danger: true,
				});
				if (confirmed) void useHistoryStore.getState().clearHistory();
			},
		},
	];
}
