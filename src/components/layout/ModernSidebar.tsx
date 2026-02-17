/**
 * Sidebar Content Component for Waypaper Engine
 *
 * Pure content component that renders inside DaisyUI's drawer-side.
 * No positioning, z-index, or overlay logic -- that is handled by
 * the DaisyUI drawer in ModernAppLayout.
 */

import type React from "react";
import { Link, useLocation } from "react-router-dom";
import SidebarConfiguration from "../SidebarConfiguration";
import { DRAWER_CHECKBOX_ID } from "./ModernAppLayout";
import { useDesignSystemStore } from "../../stores/designSystemStore";

/** Programmatically close the drawer by unchecking the toggle */
export function closeDrawer() {
	const checkbox = document.getElementById(
		DRAWER_CHECKBOX_ID,
	) as HTMLInputElement | null;
	if (checkbox) {
		checkbox.checked = false;
	}
}

export const SidebarContent: React.FC = () => {
	const location = useLocation();
	const isConfigurationPage = location.pathname === "/configuration";
	const isNeo = useDesignSystemStore(
		(s) => s.designMode === "neobrutalist",
	);

	const handleNavigationClick = () => {
		closeDrawer();
	};

	return (
		<div className="bg-base-200 min-h-full w-64 flex flex-col p-4 border-r border-base-300">
			{isConfigurationPage ? (
				<SidebarConfiguration />
			) : (
				<>
					{/* Header */}
					<div className="flex items-center gap-3 mb-6">
						<div className={`w-12 h-12 overflow-hidden flex items-center justify-center ${isNeo ? "neo-icon-box" : "rounded-lg"}`}>
							<img
								src="/app.png"
								alt="Waypaper Engine"
								className="w-full h-full object-contain"
							/>
						</div>
						<div className="flex flex-col">
							<h1 className="text-xl font-bold text-base-content">
								Waypaper Engine
							</h1>
							<p className="text-sm text-base-content/70">Wallpaper Manager</p>
						</div>
					</div>

					{/* Navigation */}
					<nav className="flex-1">
						<ul className="menu text-base-content">
							<li>
								<Link
									to="/"
									onClick={handleNavigationClick}
									className="flex items-center gap-3 p-3 rounded-lg hover:bg-base-300 transition-colors"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<title>Gallery</title>
										<rect width="7" height="7" x="3" y="3" rx="1" />
										<rect width="7" height="7" x="14" y="3" rx="1" />
										<rect width="7" height="7" x="14" y="14" rx="1" />
										<rect width="7" height="7" x="3" y="14" rx="1" />
									</svg>
									<span>Gallery</span>
								</Link>
							</li>
							<li>
								<Link
									to="/settings"
									onClick={handleNavigationClick}
									className="flex items-center gap-3 p-3 rounded-lg hover:bg-base-300 transition-colors"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<title>Settings</title>
										<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
										<circle cx="12" cy="12" r="3" />
									</svg>
									<span>Settings</span>
								</Link>
							</li>
						</ul>
					</nav>

					{/* Footer */}
					<div className="mt-auto pt-4 border-t border-base-300">
						<button
							type="button"
							onClick={() => {
								const quit = window.confirm("Are you sure you want to quit?");
								if (quit) {
									window.API_RENDERER.exitApp();
								}
							}}
							className="btn btn-error btn-sm w-full"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<title>Quit</title>
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
								<polyline points="16,17 21,12 16,7" />
								<line x1="21" y1="12" x2="9" y2="12" />
							</svg>
							Quit
						</button>
					</div>
				</>
			)}
		</div>
	);
};

export default SidebarContent;
