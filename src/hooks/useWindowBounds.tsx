import { useEffect } from "react";

export const useWindowBounds = () => {
	useEffect(() => {
		// Load and restore window bounds on mount
		const restoreWindowBounds = async () => {
			try {
				if (window.API_RENDERER?.goDaemon?.getAppConfig) {
					const config = await window.API_RENDERER.goDaemon.getAppConfig();
					// Check if config has window bounds (this would be in the app config)
					if (
						config &&
						typeof config === "object" &&
						"windowBounds" in config
					) {
						const windowBounds = (config as any).windowBounds;
						if (windowBounds && window.API_RENDERER) {
							// If Electron API is available, restore window bounds
							console.log(
								"🟢 WindowBounds: Restoring window bounds:",
								windowBounds,
							);
							// This would require an Electron API method to set window bounds
							// For now, we just load the config for future use
						}
					}
				}
			} catch (error) {
				console.error(
					"🔴 WindowBounds: Failed to restore window bounds:",
					error,
				);
			}
		};

		void restoreWindowBounds();

		const saveWindowBounds = async () => {
			try {
				// For Electron apps, we would get the window bounds here
				// For now, we'll save a placeholder or the current viewport size
				const bounds = {
					x: window.screenX || 0,
					y: window.screenY || 0,
					width: window.outerWidth || 1280,
					height: window.outerHeight || 720,
				};

				// Save to unified config system
				if (window.API_RENDERER?.goDaemon?.setConfig) {
					await window.API_RENDERER.goDaemon.setConfig(
						"app",
						"windowBounds",
						bounds,
					);
					console.log("🟢 WindowBounds: Saved window bounds:", bounds);
				}
			} catch (error) {
				console.error("🔴 WindowBounds: Failed to save window bounds:", error);
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
