/**
 * Modern App Layout Component for Waypaper Engine
 *
 * Uses DaisyUI's drawer component for the sidebar.
 * The drawer checkbox is the single source of truth for open/closed state.
 */

import type React from "react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../utils/cn";
import { SidebarContent } from "./ModernSidebar";
import NavBar from "./NavBar";
import { useSettingsStore } from "../../stores/settingsStore";
import { useDesignSystemStore } from "../../stores/designSystemStore";
import { UrlImportWarningModal } from "../UrlImportWarningModal";
import openImagesStore from "../../hooks/useOpenImages";
import { logger } from "../../utils/logger";

const IMAGE_EXTENSIONS = new Set([
	".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".tiff", ".tif",
]);

export const DRAWER_CHECKBOX_ID = "sidebar-drawer";

export interface ModernAppLayoutProps {
	children: ReactNode;
	className?: string;
}

export const ModernAppLayout: React.FC<ModernAppLayoutProps> = ({
	children,
	className,
}) => {
	const { currentTheme, isDarkMode } = useTheme();
	const config = useSettingsStore((s) => s.config);
	const syncToDOM = useDesignSystemStore((s) => s.syncToDOM);

	const [isDragging, setIsDragging] = useState(false);
	const [pendingUrls, setPendingUrls] = useState<string[]>([]);
	const dragCounterRef = useRef(0);

	useEffect(() => {
		syncToDOM();
	}, [syncToDOM]);

	const handleDragEnter = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current += 1;
		if (e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes("text/uri-list") || e.dataTransfer.types.includes("text/plain")) {
			setIsDragging(true);
		}
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current -= 1;
		if (dragCounterRef.current <= 0) {
			dragCounterRef.current = 0;
			setIsDragging(false);
		}
	}, []);

	const handleDragOver = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			e.dataTransfer.dropEffect = "copy";
		},
		[],
	);

	const importUrls = async (urls: string[]) => {
		const downloadedPaths: string[] = [];
		for (const url of urls) {
			try {
				const tmpPath = await window.API_RENDERER.downloadUrl(url);
				downloadedPaths.push(tmpPath);
			} catch (err) {
				logger.error("Failed to download URL:", url, err);
			}
		}
		if (downloadedPaths.length > 0) {
			await window.API_RENDERER.goDaemon.importImages(downloadedPaths);
		}
	};

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current = 0;
		setIsDragging(false);

		const files = e.dataTransfer.files;
		const uriList = e.dataTransfer.getData("text/uri-list");
		const textPlain = e.dataTransfer.getData("text/plain");

		const imagePaths: string[] = [];
		const otherPaths: string[] = [];
		for (let i = 0; i < (files?.length ?? 0); i++) {
			const file = files[i];
			let filePath: string | undefined;
			try {
				filePath = window.API_RENDERER.getPathForFile(file);
			} catch { /* not available */ }
			if (!filePath) continue;
			const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
			if (IMAGE_EXTENSIONS.has(ext)) {
				imagePaths.push(filePath);
			} else {
				otherPaths.push(filePath);
			}
		}

		// Fallback for Linux file managers (Nautilus/GTK) that deliver
		// dropped files as file:// URIs instead of populating dataTransfer.files.
		if (imagePaths.length === 0 && otherPaths.length === 0) {
			const rawUri = uriList || textPlain || "";
			const fileUris = rawUri
				.split(/\r?\n/)
				.map((u) => u.trim())
				.filter((u) => u.startsWith("file://"));

			for (const uri of fileUris) {
				const fsPath = decodeURIComponent(uri.replace(/^file:\/\//, ""));
				const ext = fsPath.slice(fsPath.lastIndexOf(".")).toLowerCase();
				if (IMAGE_EXTENSIONS.has(ext)) {
					imagePaths.push(fsPath);
				} else {
					otherPaths.push(fsPath);
				}
			}
		}

		if (imagePaths.length > 0) {
			void window.API_RENDERER.goDaemon.importImages(imagePaths);
		}

		if (otherPaths.length > 0) {
			for (const dirPath of otherPaths) {
				void openImagesStore.getState().importDroppedDirectory(dirPath);
			}
			return;
		}

		if (imagePaths.length > 0) return;

		const rawUrl = uriList || textPlain || "";
		const urls = rawUrl
			.split(/\r?\n/)
			.map((u) => u.trim())
			.filter((u) => u.startsWith("http://") || u.startsWith("https://"));

		if (urls.length > 0) {
			const skipWarning = localStorage.getItem("skipUrlImportWarning") === "true";
			if (skipWarning) {
				void importUrls(urls);
			} else {
				setPendingUrls(urls);
			}
		}
	}, []);

	const handleUrlImportConfirm = useCallback((dontShowAgain: boolean) => {
		if (dontShowAgain) {
			localStorage.setItem("skipUrlImportWarning", "true");
		}
		const urls = pendingUrls;
		setPendingUrls([]);
		void importUrls(urls);
	}, [pendingUrls]);

	const handleUrlImportCancel = useCallback(() => {
		setPendingUrls([]);
	}, []);

	if (!config) {
		return (
			<div className="min-h-screen bg-base-200 flex items-center justify-center">
				<div className="loading loading-spinner loading-lg"></div>
			</div>
		);
	}

	const containerClasses = cn(
		"h-screen theme-transition",
		isDarkMode ? "theme-dark" : "theme-light",
		className,
	);

	return (
		<div
			className={containerClasses}
			data-theme={currentTheme}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			{isDragging && (
				<div className="fixed inset-0 z-[200] flex items-center justify-center bg-base-300/80 backdrop-blur-sm pointer-events-none">
					<div className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-dashed border-primary">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-16 w-16 text-primary"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={1.5}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 16v-8m0 0l-3 3m3-3l3 3M3 16.5V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-1.5m-18 0V7.875c0-.621.504-1.125 1.125-1.125h3.172c.53 0 1.04.21 1.414.586l1.578 1.578c.375.375.884.586 1.414.586h6.172c.621 0 1.125.504 1.125 1.125V16.5"
							/>
						</svg>
						<span className="text-2xl font-bold text-primary">
							Drop images or folders to import
						</span>
						<span className="text-sm text-base-content/60">
							JPG, PNG, GIF, WebP, BMP, SVG, or folders
						</span>
					</div>
				</div>
			)}
			<UrlImportWarningModal
				isOpen={pendingUrls.length > 0}
				urls={pendingUrls}
				onConfirm={handleUrlImportConfirm}
				onCancel={handleUrlImportCancel}
			/>
			<div className="drawer h-screen">
				<input
					id={DRAWER_CHECKBOX_ID}
					type="checkbox"
					className="drawer-toggle"
				/>

				{/* Main content area */}
				<div className="drawer-content flex flex-col h-full min-h-0 overflow-hidden">
					<NavBar />
					<main className="flex-1 min-h-0 overflow-hidden bg-base-100">{children}</main>
				</div>

				{/* Sidebar */}
				<div className="drawer-side z-50">
					<label
						htmlFor={DRAWER_CHECKBOX_ID}
						aria-label="close sidebar"
						className="drawer-overlay"
					/>
					<SidebarContent />
				</div>
			</div>
		</div>
	);
};

export default ModernAppLayout;
