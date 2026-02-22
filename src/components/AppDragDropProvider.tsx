import type { ReactNode } from "react";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { PointerSensor, PointerActivationConstraints } from "@dnd-kit/dom";
import { arrayMove } from "@dnd-kit/helpers";
import { useDragStore, type DragSourceData, type DropTargetData } from "../stores/dragStore";
import { useFoldersStore, getAllImageIdsInFolder } from "../stores/foldersStore";
import { useImagesStore } from "../stores/images";
import { usePlaylistStore } from "../stores/playlist";
import DragPreview from "./DragPreview";

const { goDaemon } = window.API_RENDERER;

const POINTER_SENSOR = PointerSensor.configure({
	activationConstraints: [
		new PointerActivationConstraints.Distance({ value: 8 }),
	],
});

function getIds(data: DragSourceData): number[] {
	if (data.type === "image") {
		return data.selectedIds ?? (data.imageId != null ? [data.imageId] : []);
	}
	if (data.type === "folder" && data.folderId != null) return [data.folderId];
	if (data.type === "playlist-item" && data.imageId != null) return [data.imageId];
	return [];
}

export default function AppDragDropProvider({
	children,
}: { children: ReactNode }) {
	return (
		<DragDropProvider
			sensors={[POINTER_SENSOR]}
			onDragStart={(event) => {
				const data = event.operation.source?.data as DragSourceData | undefined;
				if (!data) return;
				useDragStore.getState().setDragStart(data.type, getIds(data));
			}}
			onDragOver={(event) => {
				const target = event.operation?.target;
				if (!target) {
					useDragStore.getState().setOverTarget(null);
					return;
				}
				const targetData = target.data as DropTargetData | undefined;
				if (targetData) {
					useDragStore.getState().setOverTarget({
						type: targetData.type,
						id: targetData.folderId ?? undefined,
					});
				}
			}}
			onDragEnd={(event) => {
				const { operation, canceled } = event;
				if (canceled || !operation.target) {
					if (!canceled) {
						const srcData = operation.source?.data as DragSourceData | undefined;
						if (srcData?.type === "playlist-item" && srcData.imageId != null) {
							usePlaylistStore.getState().removeImagesFromPlaylist(new Set([srcData.imageId]));
						}
					}
					useDragStore.getState().reset();
					return;
				}

				const sourceData = operation.source?.data as DragSourceData | undefined;
				const targetData = operation.target?.data as DropTargetData | undefined;

				if (!sourceData || !targetData) {
					useDragStore.getState().reset();
					return;
				}

				dispatchDrop(sourceData, targetData, operation).catch((err) => {
					console.error("Drop handler error:", err);
				}).finally(() => useDragStore.getState().reset());
			}}
		>
			{children}
			<DragOverlay>
				{(source) => <DragPreview source={source} />}
			</DragOverlay>
		</DragDropProvider>
	);
}

async function dispatchDrop(
	sourceData: DragSourceData,
	targetData: DropTargetData,
	operation: { target?: { data?: unknown } | null },
) {
	const currentFolderId = useFoldersStore.getState().currentFolderId;

	if (targetData.type === "folder" && targetData.folderId != null) {
		if (sourceData.type === "image") {
			const ids = getIds(sourceData);
			await useFoldersStore.getState().moveImagesToFolder(ids, targetData.folderId);
			useImagesStore.getState().reQueryImages();
			useFoldersStore.getState().fetchFolders(currentFolderId);
			useFoldersStore.getState().invalidateFolderPreview(targetData.folderId);
		} else if (sourceData.type === "folder" && sourceData.folderId != null) {
			if (sourceData.folderId !== targetData.folderId) {
				await goDaemon.updateFolder(sourceData.folderId, {
					parent_id: targetData.folderId,
				});
				useFoldersStore.getState().fetchFolders(currentFolderId);
			}
		}
		return;
	}

	if (targetData.type === "playlist" || targetData.type === "playlist-item") {
		if (sourceData.type === "image") {
			usePlaylistStore.getState().addImagesToPlaylist(getIds(sourceData));
			return;
		}
		if (sourceData.type === "folder" && sourceData.folderId != null) {
			const ids = await getAllImageIdsInFolder(sourceData.folderId);
			if (ids.length > 0) usePlaylistStore.getState().addImagesToPlaylist(ids);
			return;
		}
		if (targetData.type === "playlist") return;
	}

	if (targetData.type === "breadcrumb") {
		const destFolderId = targetData.folderId ?? null;
		if (sourceData.type === "image") {
			await useFoldersStore.getState().moveImagesToFolder(getIds(sourceData), destFolderId);
			useImagesStore.getState().reQueryImages();
			useFoldersStore.getState().fetchFolders(currentFolderId);
		} else if (sourceData.type === "folder" && sourceData.folderId != null) {
			await goDaemon.updateFolder(sourceData.folderId, {
				parent_id: destFolderId,
			});
			useFoldersStore.getState().fetchFolders(currentFolderId);
		}
		return;
	}

	if (targetData.type === "gallery") {
		if (sourceData.type === "playlist-item" && sourceData.imageId != null) {
			usePlaylistStore
				.getState()
				.removeImagesFromPlaylist(new Set([sourceData.imageId]));
		}
		return;
	}

	// Sortable reorder within playlist
	if (sourceData.type === "playlist-item" && sourceData.imageId != null) {
		const targetPlaylistData = operation.target?.data as DragSourceData | undefined;
		if (targetPlaylistData?.type === "playlist-item" && targetPlaylistData.imageId != null) {
			const store = usePlaylistStore.getState();
			const images = store.playlist.images;
			const sourceId = sourceData.imageId;
			const targetId = targetPlaylistData.imageId;
			if (sourceId === targetId) return;

			const oldIndex = images.findIndex((img) => img.image_id === sourceId);
			const newIndex = images.findIndex((img) => img.image_id === targetId);
			if (oldIndex === -1 || newIndex === -1) return;

			store.swapImageTimes(sourceId, targetId);

			if (store.playlist.configuration.type === "time_of_day") {
				const sorted = [...images].sort((a, b) => {
					if (a.time == null || b.time == null) return 0;
					return a.time - b.time;
				});
				store.movePlaylistArrayOrder(sorted);
			} else {
				store.movePlaylistArrayOrder(arrayMove(images, oldIndex, newIndex));
			}
		}
	}
}
