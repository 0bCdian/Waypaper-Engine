import type { MenuItem } from "../stores/contextMenuStore";
import type { WallhavenWallpaper } from "../stores/wallhavenStore";
import { useWallhavenStore } from "../stores/wallhavenStore";
import type { Monitor } from "../../electron/daemon-go-types";
import { buildWallpaperSubmenu } from "./sharedContextMenuHelpers";

export function buildWallhavenCardMenuItems(
	wp: WallhavenWallpaper,
	selectedCount: number,
	monitors: Monitor[],
): MenuItem[] {
	const items: MenuItem[] = [];

	if (selectedCount > 0) {
		items.push(...buildWallhavenSelectionItems(selectedCount));
		items.push({ type: "separator" });
	}

	const setLabel =
		wp.resolution ? `Set "${wp.id}" (${wp.resolution})` : `Set "${wp.id}"`;

	items.push(
		{
			type: "submenu",
			label: setLabel,
			children: buildWallpaperSubmenu(monitors, (monitor, mode) => {
				void useWallhavenStore.getState().downloadImportAndSet(wp, monitor, mode);
			}),
		},
		{
			type: "action",
			label: "Download to Gallery",
			onClick: () => {
				void useWallhavenStore.getState().downloadToGallery(wp);
			},
		},
		{
			type: "action",
			label: "Open on Wallhaven",
			onClick: () => {
				void window.open(wp.url, "_blank");
			},
		},
		{
			type: "action",
			label: "Copy Wallhaven URL",
			onClick: () => {
				void navigator.clipboard.writeText(wp.url);
			},
		},
	);

	return items;
}

export function buildWallhavenSelectionItems(
	selectedCount: number,
): MenuItem[] {
	if (selectedCount === 0) return [];

	return [
		{
			type: "action",
			label: `Download ${selectedCount} selected to Gallery`,
			onClick: () => {
				void useWallhavenStore.getState().downloadSelected();
			},
		},
		{
			type: "action",
			label: "Select all in current view",
			onClick: () => {
				useWallhavenStore.getState().selectAllVisible();
			},
		},
		{
			type: "action",
			label: "Clear selection",
			onClick: () => {
				useWallhavenStore.getState().clearSelection();
			},
		},
	];
}

export function buildWallhavenPageMenuItems(
	selectedCount: number,
): MenuItem[] {
	const items: MenuItem[] = [];

	if (selectedCount > 0) {
		items.push(...buildWallhavenSelectionItems(selectedCount));
		items.push({ type: "separator" });
	}

	items.push(
		{
			type: "action",
			label: "Select all in current view",
			onClick: () => {
				useWallhavenStore.getState().selectAllVisible();
			},
		},
	);

	return items;
}
