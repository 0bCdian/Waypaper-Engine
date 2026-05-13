import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import openImagesStore from "../hooks/useOpenImages";

import Modal, { type ModalHandle } from "./Modal";

const selectPending = () => openImagesStore.getState().pendingFolderImport;

function FolderImportModal() {
  const pendingFolderImport = useSyncExternalStore(openImagesStore.subscribe, selectPending);
  const modalRef = useRef<ModalHandle>(null);
  const [createFolder, setCreateFolder] = useState(true);
  const [prevPending, setPrevPending] = useState(pendingFolderImport);

  if (pendingFolderImport !== prevPending) {
    setPrevPending(pendingFolderImport);
    if (pendingFolderImport) {
      setCreateFolder(true);
    }
  }

  // Bridges external store flag (set/cleared by openImagesStore from many call sites) to imperative <dialog>.
  // oxlint-disable-next-line react-doctor/no-effect-event-handler
  useEffect(() => {
    if (pendingFolderImport) {
      modalRef.current?.showModal();
    } else {
      modalRef.current?.close();
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
    <Modal ref={modalRef} onClose={handleCancel} className="modal-box max-w-md neo-card">
      {pending && (
        <>
          <h3 className="text-lg font-semibold">Import Folder</h3>
          <p className="py-2 text-base-content/70">
            Found <span className="font-semibold text-base-content">{pending.files.length}</span>{" "}
            image
            {pending.files.length === 1 ? "" : "s"} and{" "}
            <span className="font-semibold text-base-content">{pending.webRoots.length}</span> web
            wallpaper package{pending.webRoots.length === 1 ? "" : "s"} in{" "}
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
            <button type="button" className="btn uppercase" onClick={handleCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary uppercase" onClick={handleConfirm}>
              Import
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default FolderImportModal;
