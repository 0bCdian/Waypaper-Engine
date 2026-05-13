import { useCallback, useMemo, type KeyboardEvent } from "react";
import type { Folder } from "../../electron/daemon-go-types";
import { useDraggable } from "@dnd-kit/react";
import { useDroppable } from "@dnd-kit/react";
import { useFoldersStore } from "../stores/foldersStore";
import { useImagesStore } from "../stores/images";
import { useContextMenuStore } from "../stores/contextMenuStore";
import { useToastStore } from "../stores/toastStore";
import { useInlineRename } from "../hooks/useInlineRename";
import { buildFolderMenuItems } from "../utils/contextMenuItems";
import type { DragSourceData, DropTargetData } from "../stores/dragStore";
import { cn } from "@/utils/cn";
import { Card } from "./ui/Card";

interface FolderCardProps {
  folder: Folder;
}

export const FolderIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={className}
  >
    <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
  </svg>
);

export const FolderIconLarge = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
  </svg>
);

const EMPTY_ICON = (
  <div className="flex size-full items-center justify-center">
    <FolderIconLarge className="size-16 text-primary/60 transition-all duration-300 group-hover:text-primary group-hover:scale-110" />
  </div>
);

function FolderCard({ folder }: FolderCardProps) {
  const navigateToFolder = useFoldersStore((s) => s.navigateToFolder);
  const previews = useFoldersStore((s) => s.folderPreviews.get(folder.id));
  const openContextMenu = useContextMenuStore((s) => s.open);
  const addToast = useToastStore((s) => s.addToast);

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

  const handleRenameSubmit = useCallback(
    async (newName: string) => {
      try {
        await useFoldersStore.getState().renameFolder(folder.id, newName);
        addToast("Folder renamed", "success", 2000);
      } catch {
        addToast("Failed to rename folder", "error");
      }
    },
    [folder.id, addToast],
  );

  const {
    isRenaming,
    renameName,
    setRenameName,
    renameInputRef,
    startRename,
    submitRename,
    cancelRename,
  } = useInlineRename({
    currentName: folder.name,
    onSubmit: handleRenameSubmit,
  });

  const openFolder = () => {
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
      openFolder();
    }
  };

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      dragRef(node);
      dropRef(node);
    },
    [dragRef, dropRef],
  );

  const renameInput = (
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
          cancelRename();
        }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );

  const previewGrid =
    previews && previews.length > 0 ? (
      <div
        className="grid size-full"
        style={{
          gridTemplateColumns: previews.length === 1 ? "1fr" : "1fr 1fr",
          gridTemplateRows: previews.length <= 2 ? "1fr" : "1fr 1fr",
        }}
      >
        {previews.slice(0, 4).map((thumb) => (
          <img
            key={thumb}
            src={thumb}
            alt=""
            className="size-full object-cover transform-gpu transition-all duration-300 group-hover:scale-110"
            loading="lazy"
          />
        ))}
      </div>
    ) : null;

  const dragFade = isDragging ? " opacity-50" : "";
  const dropHighlight = isDropTarget ? " ring-2 ring-primary scale-105" : "";

  return (
    <Card
      ref={mergedRef}
      elevation={0}
      data-folder-card=""
      onContextMenu={handleContextMenu}
      data-drop-target={isDropTarget || undefined}
      className={cn(
        "neo-folder-card group relative w-full overflow-hidden cursor-pointer animate-fade-in transition-all duration-200 hover:border-primary/50 hover:shadow-lg",
        dropHighlight,
        dragFade,
      )}
      onClick={openFolder}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="neo-folder-inner relative">
        <div className="neo-folder-preview w-full aspect-[3/2] bg-base-200 overflow-hidden">
          {previewGrid ?? EMPTY_ICON}
        </div>
        <div className="neo-folder-caption absolute bottom-0 w-full bg-base-content/75 p-2 opacity-0 transition-all duration-300 group-hover:opacity-100 text-base-100">
          {isRenaming ? (
            renameInput
          ) : (
            <p
              className="neo-folder-name w-full overflow-hidden truncate text-ellipsis text-lg font-medium flex items-center gap-2"
              // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- stopPropagation guard so click on the name doesn't activate the card
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startRename();
              }}
            >
              <FolderIcon className="size-4 shrink-0" />
              {folder.name}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default FolderCard;
