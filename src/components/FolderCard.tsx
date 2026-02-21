import { useState, useRef, useCallback, useMemo, type KeyboardEvent } from "react";
import type { Folder } from "../../electron/daemon-go-types";
import { useDraggable } from "@dnd-kit/react";
import { useDroppable } from "@dnd-kit/react";
import { useFoldersStore } from "../stores/foldersStore";
import { useImagesStore } from "../stores/images";
import { useContextMenuStore } from "../stores/contextMenuStore";
import { useToastStore } from "../stores/toastStore";
import { buildFolderMenuItems } from "../utils/contextMenuItems";
import type { DragSourceData, DropTargetData } from "../stores/dragStore";

interface FolderCardProps {
	folder: Folder;
}

function FolderCard({ folder }: FolderCardProps) {
	const navigateToFolder = useFoldersStore((s) => s.navigateToFolder);
	const openContextMenu = useContextMenuStore((s) => s.open);
	const addToast = useToastStore((s) => s.addToast);
	const [isRenaming, setIsRenaming] = useState(false);
	const [renameName, setRenameName] = useState(folder.name);
	const renameInputRef = useRef<HTMLInputElement>(null);

	const dragData = useMemo<DragSourceData>(
		() => ({ type: "folder", folderId: folder.id }),
		[folder.id],
	);
	const { ref: dragRef, isDragging } = useDraggable({
		id: `folder-drag-${folder.id}`,
		data: dragData,
	});

	const dropData = useMemo<DropTargetData>(
		() => ({ type: "folder", folderId: folder.id }),
		[folder.id],
	);
	const { ref: dropRef, isDropTarget } = useDroppable({
		id: `folder-drop-${folder.id}`,
		data: dropData,
	});

	const startRename = useCallback(() => {
		setRenameName(folder.name);
		setIsRenaming(true);
		requestAnimationFrame(() => renameInputRef.current?.select());
	}, [folder.name]);

	const handleClick = () => {
		if (isRenaming) return;
		navigateToFolder(folder.id);
		useImagesStore.getState().fetchPage(1, {
			folder_id: folder.id,
		});
	};

	const handleContextMenu = (e: React.MouseEvent) => {
		const items = buildFolderMenuItems(folder, startRename);
		openContextMenu(e, items);
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "F2") {
			e.preventDefault();
			startRename();
		} else if (e.key === "Enter") {
			handleClick();
		}
	};

	const submitRename = useCallback(async () => {
		setIsRenaming(false);
		const trimmed = renameName.trim();
		if (!trimmed || trimmed === folder.name) return;
		try {
			await useFoldersStore.getState().renameFolder(folder.id, trimmed);
			addToast("Folder renamed", "success", 2000);
		} catch {
			addToast("Failed to rename folder", "error");
		}
	}, [folder.id, folder.name, renameName, addToast]);

	const mergedRef = useCallback(
		(node: HTMLDivElement | null) => {
			dragRef(node);
			dropRef(node);
		},
		[dragRef, dropRef],
	);

	const dropHighlight = isDropTarget ? " ring-2 ring-primary scale-105" : "";
	const dragFade = isDragging ? " opacity-50" : "";

	return (
		<div
			ref={mergedRef}
			onContextMenu={handleContextMenu}
			className={`group relative w-full overflow-hidden rounded-lg duration-200 animate-fade-in cursor-pointer transition-all${dropHighlight}${dragFade}`}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			role="button"
			tabIndex={0}
		>
			<div className="relative w-full aspect-[3/2] bg-base-200 flex items-center justify-center rounded-lg border-2 border-base-300 transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-lg">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					className="h-16 w-16 text-primary/60 transition-all duration-300 group-hover:text-primary group-hover:scale-110"
				>
					<path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
				</svg>
			</div>

			<div className="absolute bottom-0 w-full bg-base-content/75 p-2 pl-2 opacity-0 transition-all duration-300 group-hover:opacity-100 text-base-100 rounded-b-lg">
				{isRenaming ? (
					<input
						ref={renameInputRef}
						type="text"
						className="input input-xs w-full bg-base-100 text-base-content font-medium"
						value={renameName}
						onChange={(e) => setRenameName(e.target.value)}
						onBlur={() => void submitRename()}
						onKeyDown={(e) => {
							e.stopPropagation();
							if (e.key === "Enter") {
								e.preventDefault();
								renameInputRef.current?.blur();
							} else if (e.key === "Escape") {
								setIsRenaming(false);
								setRenameName(folder.name);
							}
						}}
						onClick={(e) => e.stopPropagation()}
					/>
				) : (
				<p
					className="w-full overflow-hidden truncate text-ellipsis text-lg font-medium flex items-center gap-2"
					onClick={(e) => e.stopPropagation()}
					onDoubleClick={(e) => {
						e.stopPropagation(); startRename();
					}}
				>
					<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							className="h-4 w-4 shrink-0"
						>
							<path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
						</svg>
						{folder.name}
					</p>
				)}
			</div>
		</div>
	);
}

export default FolderCard;
