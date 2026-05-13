import { useState, useEffect, useRef, useCallback } from "react";
import type { Folder } from "../../electron/daemon-go-types";
import { useFoldersStore } from "../stores/foldersStore";
import { useImagesStore } from "../stores/images";
import { useFolderPickerStore } from "../stores/folderPickerStore";
import { useShallow } from "zustand/react/shallow";
import { useToastStore } from "../stores/toastStore";
import { FolderIcon } from "./FolderCard";
import Modal, { type ModalHandle } from "./Modal";
import { daemonClient } from "@/client";

async function fetchRootFolders(): Promise<Folder[]> {
  try {
    const result = await daemonClient.getFolders(undefined);
    return result.data || [];
  } catch {
    return [];
  }
}

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
        const result = await daemonClient.getFolders(folder.id);
        const data = result.data;
        if (data) {
          setChildren(data);
        } else {
          setChildren([]);
        }
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
          isSelected ? "bg-primary/15 text-primary" : "hover:bg-base-200"
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(folder.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSelect(folder.id);
        }}
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
            className={`size-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <FolderIcon className="size-4 text-primary/70 shrink-0" />
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
  const { isOpen, imageIds, close } = useFolderPickerStore(
    useShallow((s) => ({
      isOpen: s.isOpen,
      imageIds: s.imageIds,
      close: s.close,
    })),
  );
  const addToast = useToastStore((s) => s.addToast);
  const modalRef = useRef<ModalHandle>(null);
  const [rootFolders, setRootFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRootFolders().then(setRootFolders);
      modalRef.current?.showModal();
    } else {
      modalRef.current?.close();
    }
  }, [isOpen]);

  const [lastOpenState, setLastOpenState] = useState(isOpen);
  if (isOpen !== lastOpenState) {
    setLastOpenState(isOpen);
    if (isOpen) {
      setSelectedFolderId(null);
      setIsCreating(false);
    }
  }

  const handleMove = useCallback(async () => {
    if (imageIds.length === 0) return;
    try {
      await useFoldersStore.getState().moveImagesToFolder(imageIds, selectedFolderId);
      useImagesStore.getState().clearSelection();
      useImagesStore.getState().reQueryImages();
      const fid = useFoldersStore.getState().currentFolderId;
      useFoldersStore.getState().fetchFolders(fid);
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
    <Modal ref={modalRef} onClose={close} className="modal-box max-w-sm">
      <h3 className="text-lg font-semibold">Move to folder</h3>
      <p className="text-sm text-base-content/60 mt-1">Moving {imageIds.length} image(s)</p>

      <div className="mt-3 max-h-64 overflow-y-auto border border-base-300 rounded-lg">
        <div
          className={`flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer transition-colors ${
            isRootSelected ? "bg-primary/15 text-primary" : "hover:bg-base-200"
          }`}
          onClick={() => setSelectedFolderId(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setSelectedFolderId(null);
          }}
          role="button"
          tabIndex={0}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4"
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
            className="size-4"
          >
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          New folder
        </button>
      )}

      <div className="modal-action">
        <button type="button" className="btn" onClick={close}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void handleMove()}>
          Move here
        </button>
      </div>
    </Modal>
  );
}

export default FolderPickerModal;
