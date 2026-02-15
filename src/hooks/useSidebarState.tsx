import { useState, useEffect } from "react";

const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

/**
 * Hook to manage sidebar collapsed state in localStorage
 */
export function useSidebarState() {
	const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
		const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
		return stored === "true";
	});

	useEffect(() => {
		localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
	}, [isCollapsed]);

	const toggle = () => setIsCollapsed((prev) => !prev);
	const setCollapsed = (collapsed: boolean) => setIsCollapsed(collapsed);

	return {
		isCollapsed,
		toggle,
		setCollapsed,
	};
}

