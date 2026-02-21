import { useState, useEffect, useRef, useCallback } from "react";
import { create } from "zustand";
import type { Folder } from "../../electron/daemon-go-types";
import { useFoldersStore } from "../stores/foldersStore";
import { useImagesStore } from "../stores/images";
import { useDesignSystemStore } from "../stores/designSystemStore";
import { useToastStore } from "../stores/toastStore";

const { goDaemon } = window.API_RENDERER;

interface FolderPickerState {
	isOpen: boolean;
	imageIds: number[];
	open: (imageIds: number[]) => void;
	close: () => void;
}

export const useFolderPickerStore = create<FolderPickerState>()((set) => ({
	isOpen: false,
	imageIds: [],
	open: (imageIds: number[]) => set({ isOpen: true, imageIds }),
	close: () => set({ isOpen: false, imageIds: [] }),
}));

interface FolderTreeItemProps {
	folder: Folder;
	level: number;
	selectedId: number | null;
	onSelect: (id: number | null) => void;
}

function FolderTreeItem({ folder, level, selectedId, onSelect }: FolderTreeItemProps) {
	const [expanded, setExpanded] = useState(false);
	const [children, setChildren] = useState<Folder[]>([]);
	const [loaded, setLoaded] = useState(false);

	const handleToggle = async () => {
		if (!loaded) {
			try {
				const result = await goDaemon.getFolders(folder.id);
				setChildren(result.data || []);
				setLoaded(true);
			} catch {
				setChildren([]);
			}
		}
		setExpanded(!expanded);
	};

	const isSelected = selectedId === folder.id;

	return (
		<div>
			<div
				className={`flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
					isSelected
						? "bg-primary/15 text-primary"
						: "hover:bg-base-200"
				}`}
				style={{ paddingLeft: `${level * 16 + 8}px` }}
				onClick={() => onSelect(folder.id)}
				onKeyDown={(e) => { if (e.key === "Enter") onSelect(folder.id); }}
				role="button"
				tabIndex={0}
			>
				<button
					type="button"
					className="btn btn-ghost btn-xs btn-square"
					onClick={(e) => {
						e.stopPropagation();
						void handleToggle();
					}}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
					>
						<path
							fillRule="evenodd"
							d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
							clipRule="evenodd"
						/>
					</svg>
				</button>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					className="h-4 w-4 text-primary/70 shrink-0"
				>
					<path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
				</svg>
				<span className="text-sm truncate">{folder.name}</span>
			</div>
			{expanded && children.length > 0 && (
				<div>
					{children.map((child) => (
						<FolderTreeItem
							key={child.id}
							folder={child}
							level={level + 1}
							selectedId={selectedId}
							onSelect={onSelect}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function FolderPickerModal() {
	const { isOpen, imageIds, close } = useFolderPickerStore();
	const isNeo = useDesignSystemStore((s) => s.designMode === "neobrutalist");
	const addToast = useToastStore((s) => s.addToast);
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [rootFolders, setRootFolders] = useState<Folder[]>([]);
	const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");
	const newFolderInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			setSelectedFolderId(null);
			setIsCreating(false);
			void loadRootFolders();
			dialogRef.current?.showModal();
		} else {
			dialogRef.current?.close();
		}
	}, [isOpen]);

	const loadRootFolders = async () => {
		try {
			const result = await goDaemon.getFolders(undefined);
			setRootFolders(result.data || []);
		} catch {
			setRootFolders([]);
		}
	};

	const handleMove = useCallback(async () => {
		if (imageIds.length === 0) return;
		try {
			await useFoldersStore.getState().moveImagesToFolder(imageIds, selectedFolderId);
			useImagesStore.getState().clearSelection();
			const fid = useFoldersStore.getState().currentFolderId;
			useImagesStore.getState().fetchPage(1, {
				folder_id: fid === null ? "root" : fid,
			});
			addToast(`Moved ${imageIds.length} image(s)`, "success", 2000);
			close();
		} catch {
			addToast("Failed to move images", "error");
		}
	}, [imageIds, selectedFolderId, close, addToast]);

	const handleCreateFolder = useCallback(async () => {
		const name = newFolderName.trim();
		if (!name) return;
		try {
			const folder = await useFoldersStore.getState().createFolder(name);
			setRootFolders((prev) => [...prev, folder]);
			setSelectedFolderId(folder.id);
			setIsCreating(false);
			setNewFolderName("");
		} catch {
			addToast("Failed to create folder", "error");
		}
	}, [newFolderName, addToast]);

	const isRootSelected = selectedFolderId === null;

	return (
		<dialog ref={dialogRef} className="modal" onClose={close}>
			<div className={`modal-box max-w-sm ${isNeo ? "neo-card" : ""}`}>
				<h3 className="text-lg font-bold">Move to folder</h3>
				<p className="text-sm text-base-content/60 mt-1">
					Moving {imageIds.length} image(s)
				</p>

				<div className="mt-3 max-h-64 overflow-y-auto border border-base-300 rounded-lg">
					<div
						className={`flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer transition-colors ${
							isRootSelected
								? "bg-primary/15 text-primary"
								: "hover:bg-base-200"
						}`}
						onClick={() => setSelectedFolderId(null)}
						onKeyDown={(e) => { if (e.key === "Enter") setSelectedFolderId(null); }}
						role="button"
						tabIndex={0}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							className="h-4 w-4"
						>
							<path
								fillRule="evenodd"
								d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z"
								clipRule="evenodd"
							/>
						</svg>
						<span className="text-sm font-medium">Gallery root</span>
					</div>
					{rootFolders.map((folder) => (
						<FolderTreeItem
							key={folder.id}
							folder={folder}
							level={0}
							selectedId={selectedFolderId}
							onSelect={setSelectedFolderId}
						/>
					))}
				</div>

				{isCreating ? (
					<div className="flex items-center gap-2 mt-3">
						<input
							ref={newFolderInputRef}
							type="text"
							className="input input-sm input-bordered flex-1"
							placeholder="Folder name"
							value={newFolderName}
							onChange={(e) => setNewFolderName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") void handleCreateFolder();
								if (e.key === "Escape") {
									setIsCreating(false);
									setNewFolderName("");
								}
							}}
							autoFocus
						/>
						<button
							type="button"
							className="btn btn-sm btn-primary"
							onClick={() => void handleCreateFolder()}
							disabled={!newFolderName.trim()}
						>
							Create
						</button>
						<button
							type="button"
							className="btn btn-sm btn-ghost"
							onClick={() => {
								setIsCreating(false);
								setNewFolderName("");
							}}
						>
							Cancel
						</button>
					</div>
				) : (
					<button
						type="button"
						className="btn btn-sm btn-ghost gap-1 mt-3"
						onClick={() => {
							setIsCreating(true);
							requestAnimationFrame(() => newFolderInputRef.current?.focus());
						}}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							className="h-4 w-4"
						>
							<path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
						</svg>
						New folder
					</button>
				)}

				<div className="modal-action">
					<button
						type="button"
						className={isNeo ? "btn uppercase" : "btn"}
						onClick={close}
					>
						Cancel
					</button>
					<button
						type="button"
						className={isNeo ? "btn btn-primary uppercase" : "btn btn-primary"}
						onClick={() => void handleMove()}
					>
						Move here
					</button>
				</div>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="submit" onClick={close}>
					close
				</button>
			</form>
		</dialog>
	);
}

export default FolderPickerModal;
