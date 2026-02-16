/**
 * Sidebar state utilities for the DaisyUI drawer.
 *
 * The DaisyUI drawer checkbox is the source of truth for open/closed state.
 * This module provides helpers for programmatic control.
 */

const DRAWER_CHECKBOX_ID = "sidebar-drawer";

function getCheckbox(): HTMLInputElement | null {
	return document.getElementById(DRAWER_CHECKBOX_ID) as HTMLInputElement | null;
}

/** Open the drawer */
export function openDrawer() {
	const cb = getCheckbox();
	if (cb) cb.checked = true;
}

/** Close the drawer */
export function closeDrawer() {
	const cb = getCheckbox();
	if (cb) cb.checked = false;
}

/** Toggle the drawer */
export function toggleDrawer() {
	const cb = getCheckbox();
	if (cb) cb.checked = !cb.checked;
}
