import { useCallback, useRef, useState } from "react";

export interface DropZoneHandlers {
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export function useDropZone(onDrop: (e: React.DragEvent) => void): {
  isDragging: boolean;
  handlers: DropZoneHandlers;
} {
  const [isDragging, setIsDragging] = useState(false);
  const counter = useRef(0);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    counter.current += 1;
    if (
      e.dataTransfer.types.includes("Files") ||
      e.dataTransfer.types.includes("text/uri-list") ||
      e.dataTransfer.types.includes("text/plain")
    ) {
      setIsDragging(true);
    }
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    counter.current -= 1;
    if (counter.current <= 0) {
      counter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragEnd = useCallback(() => {
    counter.current = 0;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      counter.current = 0;
      setIsDragging(false);
      onDrop(e);
    },
    [onDrop],
  );

  return {
    isDragging,
    handlers: {
      onDragEnter,
      onDragLeave,
      onDragOver,
      onDrop: handleDrop,
      onDragEnd,
    },
  };
}
