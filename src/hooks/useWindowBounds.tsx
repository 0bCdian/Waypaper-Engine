import { useEffect } from "react";

export const useWindowBounds = () => {
	useEffect(() => {
		// Load and restore window bounds on mount
		const restoreWindowBounds = async () => {
			try {
				// Use Electron's native API to get window bounds
				if (window.API_RENDERER?.getWindowBounds) {
					const bounds = await window.API_RENDERER.getWindowBounds();
					if (bounds) {
						console.log(
							"🟢 WindowBounds: Current window bounds:",
							bounds,
						);
						// Bounds are managed by Electron, no need to restore
					}
				}
			} catch (error) {
				console.error(
					"🔴 WindowBounds: Failed to get window bounds:",
					error,
				);
			}
		};

		void restoreWindowBounds();

		const saveWindowBounds = async () => {
			try {
				// Use Electron's native API to get and save window bounds
				if (window.API_RENDERER?.getWindowBounds) {
					const bounds = await window.API_RENDERER.getWindowBounds();
					if (bounds) {
						console.log("🟢 WindowBounds: Saved window bounds:", bounds);
						// Electron persists bounds automatically, no need to manually save
					}
				}
			} catch (error) {
				// Silently fail - window bounds are not critical
				console.debug("WindowBounds: Could not save bounds:", error);
			}
		};

		// Save bounds when component unmounts (window closes)
		const handleBeforeUnload = () => {
			// Fire and forget - don't await
			void saveWindowBounds();
		};

		// Also save bounds periodically (every 5 seconds if window is moved/resized)
		let lastBounds = {
			x: window.screenX,
			y: window.screenY,
			width: window.outerWidth,
			height: window.outerHeight,
		};
		const saveInterval = setInterval(() => {
			const currentBounds = {
				x: window.screenX,
				y: window.screenY,
				width: window.outerWidth,
				height: window.outerHeight,
			};
			if (JSON.stringify(currentBounds) !== JSON.stringify(lastBounds)) {
				lastBounds = currentBounds;
				void saveWindowBounds();
			}
		}, 5000);

		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			clearInterval(saveInterval);
			window.removeEventListener("beforeunload", handleBeforeUnload);
			// Save one last time on cleanup
			void saveWindowBounds();
		};
	}, []);
};
