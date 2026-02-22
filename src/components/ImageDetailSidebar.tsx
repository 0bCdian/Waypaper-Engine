import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
} from "react";
import { useImageDetailStore } from "../stores/imageDetailStore";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { useToastStore } from "../stores/toastStore";
import { useIsNeo } from "../hooks/useIsNeo";

const { goDaemon } = window.API_RENDERER;

async function saveImageTags(imageId: number, tags: string[]) {
	await goDaemon.updateImage(imageId, { tags });
	const freshImage = await goDaemon.getImage(imageId);
	useImageDetailStore.getState().open(freshImage);
	useImagesStore.getState().reQueryImages();
}

async function performImageRename(imageId: number, newName: string) {
	const updated = await useImagesStore.getState().renameImage(imageId, newName);
	useImageDetailStore.getState().open(
		updated as unknown as import("../../electron/daemon-go-types").Image,
	);
	return updated;
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImageDetailSidebar() {
	const { selectedImage, isOpen, close } = useImageDetailStore(useShallow((s) => ({ selectedImage: s.selectedImage, isOpen: s.isOpen, close: s.close })));
	const addToast = useToastStore((s) => s.addToast);
	const isNeo = useIsNeo();
	const [tags, setTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState("");
	const [allTags, setAllTags] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const [editName, setEditName] = useState("");
	const [renaming, setRenaming] = useState(false);
	const nameInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (selectedImage) {
			setTags([...(selectedImage.tags ?? [])]);
			setEditName(selectedImage.name);
		}
	}, [selectedImage]);

	useEffect(() => {
		if (isOpen) {
			void goDaemon.getImageTags().then((resp) => {
				setAllTags(resp.tags ?? []);
			}).catch(() => {});
		}
	}, [isOpen]);

	const suggestions = useMemo(() => {
		if (!tagInput.trim()) return [];
		const term = tagInput.toLowerCase();
		const tagSet = new Set(tags.map((t) => t.toLowerCase()));
		return allTags
			.filter(
				(t) =>
					t.toLowerCase().includes(term) &&
					!tagSet.has(t.toLowerCase()),
			)
			.slice(0, 8);
	}, [tagInput, allTags, tags]);

	const addTag = useCallback(
		(tag: string) => {
			const trimmed = tag.trim().toLowerCase();
			if (!trimmed) return;
			if (tags.some((t) => t.toLowerCase() === trimmed)) return;
			setTags((prev) => [...prev, trimmed]);
			setTagInput("");
			setShowSuggestions(false);
		},
		[tags],
	);

	const removeTag = useCallback((tag: string) => {
		setTags((prev) => prev.filter((t) => t !== tag));
	}, []);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault();
				addTag(tagInput);
			} else if (
				e.key === "Backspace" &&
				tagInput === "" &&
				tags.length > 0
			) {
				setTags((prev) => prev.slice(0, -1));
			} else if (e.key === "Escape") {
				setShowSuggestions(false);
			}
		},
		[tagInput, tags, addTag],
	);

	const handleSave = useCallback(async () => {
		if (!selectedImage) return;
		setSaving(true);
		try {
			await saveImageTags(selectedImage.id, tags);
			addToast("Tags saved", "success", 2000);
		} catch {
			addToast("Failed to save tags", "error");
		} finally {
			setSaving(false);
		}
	}, [selectedImage, tags, addToast]);

	const submitRename = useCallback(async () => {
		if (!selectedImage) return;
		const trimmed = editName.trim();
		if (!trimmed || trimmed === selectedImage.name) {
			setEditName(selectedImage.name);
			return;
		}
		setRenaming(true);
		try {
			const updated = await performImageRename(selectedImage.id, trimmed);
			if (updated.name !== trimmed) {
				addToast(`Renamed to "${updated.name}" (original name was taken)`, "info", 3000);
			} else {
				addToast("Image renamed", "success", 2000);
			}
		} catch {
			addToast("Failed to rename image", "error");
			setEditName(selectedImage.name);
		} finally {
			setRenaming(false);
		}
	}, [selectedImage, editName, addToast]);

	const hasChanges = useMemo(() => {
		const original = selectedImage?.tags ?? [];
		if (original.length !== tags.length) return true;
		const s = new Set(original);
		return tags.some((t) => !s.has(t));
	}, [selectedImage?.tags, tags]);

	return (
		<>
		{/* Overlay backdrop — click to close, same as left drawer */}
		<div
			className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 ${
				isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
			}`}
			onClick={close}
			onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
			role="button"
			tabIndex={isOpen ? 0 : -1}
			aria-label="close sidebar"
		/>
		<div
			className={`fixed inset-y-0 right-0 z-50 flex w-full lg:w-80 flex-col border-l border-base-300 bg-base-200 shadow-xl transition-transform duration-300 ease-in-out ${
				isOpen ? "translate-x-0" : "translate-x-full"
			} ${isNeo ? "neo-card" : ""}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
				<h3 className="text-sm font-bold uppercase tracking-wide text-base-content">
					Image Details
				</h3>
				<button
					type="button"
					className="btn btn-ghost btn-sm btn-square"
					onClick={close}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						className="h-5 w-5"
					>
						<path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
					</svg>
				</button>
			</div>

			{selectedImage && (
				<div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
					{/* Preview */}
					{selectedImage.thumbnails?.default && (
						<img
							src={selectedImage.thumbnails.default}
							alt={selectedImage.name}
							className="w-full rounded-lg object-cover"
						/>
					)}

					{/* Editable name */}
					<div className="space-y-1">
					<label htmlFor="image-detail-name" className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
						Name
					</label>
					<input
						id="image-detail-name"
						ref={nameInputRef}
						type="text"
							className="input input-bordered input-sm w-full font-medium"
							value={editName}
							disabled={renaming}
							onChange={(e) => setEditName(e.target.value)}
							onBlur={() => void submitRename()}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									nameInputRef.current?.blur();
								} else if (e.key === "Escape") {
									setEditName(selectedImage.name);
									nameInputRef.current?.blur();
								}
							}}
						/>
					</div>

					{/* Metadata */}
					<div className="space-y-1 text-xs text-base-content/70">
						<p>
							{selectedImage.width} &times; {selectedImage.height}
						</p>
						<p>
							{selectedImage.format.toUpperCase()} &middot;{" "}
							{formatFileSize(selectedImage.file_size)}
						</p>
					</div>

					{/* Color Palette */}
					{selectedImage.colors && selectedImage.colors.length > 0 && (
						<div className="space-y-1">
							<label className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
								Colors
							</label>
							<div className="flex flex-wrap gap-1.5">
							{selectedImage.colors.map((c, i) => (
								<button
									type="button"
									key={`${c}-${i}`}
										className="w-6 h-6 rounded border border-base-content/20 cursor-pointer tooltip p-0"
										style={{ backgroundColor: c }}
										data-tip={c}
										title={c}
										aria-label={`Copy color ${c}`}
										onClick={() => void navigator.clipboard.writeText(c)}
									/>
								))}
							</div>
						</div>
					)}

					{/* Tags */}
					<div className="space-y-2">
					<label htmlFor="image-detail-tags" className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
						Tags
					</label>

						{/* Current tags */}
						<div className="flex flex-wrap gap-1.5">
							{tags.map((tag) => (
								<span
									key={tag}
									className="badge badge-primary gap-1 text-xs"
								>
									{tag}
									<button
										type="button"
										className="ml-0.5 opacity-70 hover:opacity-100"
										onClick={() => removeTag(tag)}
									>
										&times;
									</button>
								</span>
							))}
							{tags.length === 0 && (
								<span className="text-xs text-base-content/40">
									No tags yet
								</span>
							)}
						</div>

						{/* Tag input */}
						<div className="relative">
						<input
							id="image-detail-tags"
							ref={inputRef}
							type="text"
							className="input input-bordered input-sm w-full"
							placeholder="Add a tag..."
								value={tagInput}
								onChange={(e) => {
									setTagInput(e.target.value);
									setShowSuggestions(true);
								}}
								onKeyDown={handleKeyDown}
								onFocus={() => setShowSuggestions(true)}
								onBlur={() =>
									setTimeout(() => setShowSuggestions(false), 150)
								}
							/>

							{/* Autocomplete dropdown */}
							{showSuggestions && suggestions.length > 0 && (
								<ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-lg">
									{suggestions.map((s) => (
										<li key={s}>
											<button
												type="button"
												className="w-full px-3 py-1.5 text-left text-xs hover:bg-base-200"
												onMouseDown={(e) => {
													e.preventDefault();
													addTag(s);
												}}
											>
												{s}
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>

					{/* Save button */}
					<button
						type="button"
						className={`btn btn-primary btn-sm ${!hasChanges ? "btn-disabled" : ""}`}
						onClick={handleSave}
						disabled={!hasChanges || saving}
					>
						{saving ? "Saving..." : "Save Tags"}
					</button>
				</div>
			)}
		</div>
		</>
	);
}

export default ImageDetailSidebar;
