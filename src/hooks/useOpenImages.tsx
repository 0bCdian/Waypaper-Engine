import { create } from "zustand";
import { type openFileAction, type imagesObject } from "../../shared/types";
const { openFiles, handleOpenImages } = window.API_RENDERER;

interface State {
	isActive: boolean;
}

interface openImagesProps {
	action: openFileAction;
}

interface Actions {
	openImages: (openImagesProps: openImagesProps) => Promise<void>;
}

const openImagesStore = create<State & Actions>((set) => ({
	isActive: false,
	openImages: async ({ action }) => {
		console.log("🟢 useOpenImages: Starting openImages with action:", action);
		set(() => ({ isActive: true }));
		
		const result = await openFiles(action);
		console.log("🟢 useOpenImages: openFiles returned:", result);
		
		set(() => ({ isActive: false }));

		if (!result.success) {
			console.warn("🟡 useOpenImages: openFiles returned unsuccessful:", result);
			return;
		}

		// Check for files in result.data.files (the actual structure returned)
		const files = result.data?.files || result.files || [];
		
		if (files.length === 0) {
			console.warn("🟡 useOpenImages: No files returned from dialog");
			return;
		}

		console.log("🟢 useOpenImages: Files selected:", files.length, "files");

		// Format for handleOpenImages which expects {success: boolean, data: {files: string[]}}
		const imagesObject = {
			success: true,
			data: {
				files: files,
			},
		};

		console.log("🟢 useOpenImages: Calling handleOpenImages with:", imagesObject);
		
		// Send images to daemon for processing
		try {
			const handleResult = await handleOpenImages(imagesObject);
			console.log("🟢 useOpenImages: handleOpenImages returned:", handleResult);
		} catch (error) {
			console.error("🔴 useOpenImages: Error calling handleOpenImages:", error);
		}
		// Progress will be handled by real-time events
		// Images will appear automatically as they're processed
	},
}));

export default openImagesStore;
