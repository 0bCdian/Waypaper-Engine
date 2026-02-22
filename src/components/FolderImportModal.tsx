import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import openImagesStore from "../hooks/useOpenImages";
import { useIsNeo } from "../hooks/useIsNeo";

const selectPending = () => openImagesStore.getState().pendingFolderImport;

function FolderImportModal() {
	const pendingFolderImport = useSyncExternalStore(
		openImagesStore.subscribe,
		selectPending,
	);
	const isNeo = useIsNeo();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [createFolder, setCreateFolder] = useState(true);
	const [prevPending, setPrevPending] = useState(pendingFolderImport);

	if (pendingFolderImport !== prevPending) {
		setPrevPending(pendingFolderImport);
		if (pendingFolderImport) {
			setCreateFolder(true);
		}
	}

	useEffect(() => {
		if (pendingFolderImport) {
			dialogRef.current?.showModal();
		} else {
			dialogRef.current?.close();
		}
	}, [pendingFolderImport]);

	const handleConfirm = useCallback(() => {
		void openImagesStore.getState().confirmFolderImport(createFolder);
	}, [createFolder]);

	const handleCancel = useCallback(() => {
		openImagesStore.getState().cancelFolderImport();
	}, []);

	const pending = pendingFolderImport;

	return (
		<dialog ref={dialogRef} className="modal" onClose={handleCancel}>
			{pending && (
				<>
					<div className={`modal-box max-w-md ${isNeo ? "neo-card" : ""}`}>
						<h3 className="text-lg font-bold">Import Folder</h3>
						<p className="py-2 text-base-content/70">
							Found <span className="font-semibold text-base-content">{pending.files.length}</span> images in{" "}
							<span className="font-semibold text-base-content">"{pending.folderName}"</span>
						</p>

						<div className="flex flex-col gap-3 py-3">
						<label
							htmlFor="folder-import-create"
							className={`flex items-start gap-3 rounded-lg border-2 p-3 cursor-pointer transition-all ${
								createFolder
									? "border-primary bg-primary/5"
									: "border-base-300 hover:border-base-content/20"
							}`}
						>
							<input
								id="folder-import-create"
								type="radio"
								name="import-mode"
								className="radio radio-primary mt-0.5"
								checked={createFolder}
								onChange={() => setCreateFolder(true)}
							/>
								<div>
									<p className="font-medium">Create as folder</p>
									<p className="text-sm text-base-content/60">
										Creates a "{pending.folderName}" folder in the gallery and imports images into it
									</p>
								</div>
							</label>

						<label
							htmlFor="folder-import-individual"
							className={`flex items-start gap-3 rounded-lg border-2 p-3 cursor-pointer transition-all ${
								!createFolder
									? "border-primary bg-primary/5"
									: "border-base-300 hover:border-base-content/20"
							}`}
						>
							<input
								id="folder-import-individual"
								type="radio"
								name="import-mode"
								className="radio radio-primary mt-0.5"
								checked={!createFolder}
								onChange={() => setCreateFolder(false)}
							/>
								<div>
									<p className="font-medium">Import individually</p>
									<p className="text-sm text-base-content/60">
										Imports all images to the current gallery level without creating a folder
									</p>
								</div>
							</label>
						</div>

						<div className="modal-action">
							<button
								type="button"
								className={isNeo ? "btn uppercase" : "btn"}
								onClick={handleCancel}
							>
								Cancel
							</button>
							<button
								type="button"
								className={isNeo ? "btn btn-primary uppercase" : "btn btn-primary"}
								onClick={handleConfirm}
							>
								Import
							</button>
						</div>
					</div>
					<form method="dialog" className="modal-backdrop">
						<button type="submit" onClick={handleCancel}>
							close
						</button>
					</form>
				</>
			)}
		</dialog>
	);
}

export default FolderImportModal;
