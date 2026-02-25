import { useState, useRef, useCallback } from "react";

interface UseInlineRenameOpts {
  currentName: string;
  onSubmit: (newName: string) => Promise<void>;
}

export function useInlineRename({ currentName, onSubmit }: UseInlineRenameOpts) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback(() => {
    setRenameName(currentName);
    setIsRenaming(true);
    requestAnimationFrame(() => renameInputRef.current?.select());
  }, [currentName]);

  const submitRename = useCallback(async () => {
    setIsRenaming(false);
    const trimmed = renameName.trim();
    if (!trimmed || trimmed === currentName) return;
    await onSubmit(trimmed);
  }, [currentName, renameName, onSubmit]);

  const cancelRename = useCallback(() => {
    setIsRenaming(false);
    setRenameName(currentName);
  }, [currentName]);

  return {
    isRenaming,
    renameName,
    setRenameName,
    renameInputRef,
    startRename,
    submitRename,
    cancelRename,
  };
}
