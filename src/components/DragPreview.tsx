import { useDragStore } from "../stores/dragStore";
import { useImagesStore } from "../stores/images";
import { useFoldersStore } from "../stores/foldersStore";
import { getThumbnailSrc } from "../utils/utilities";

interface DragPreviewProps {
  source: { id: string | number; data?: unknown } | null;
}

export default function DragPreview({ source }: DragPreviewProps) {
  const dragType = useDragStore((s) => s.dragType);
  const dragIds = useDragStore((s) => s.dragIds);
  const imagesMap = useImagesStore((s) => s.imagesMap);
  const folders = useFoldersStore((s) => s.folders);

  if (!source || !dragType) return null;

  if (dragType === "folder") {
    const folder = folders.find((f) => f.id === dragIds[0]);
    return (
      <div className="flex items-center gap-2 rounded-lg bg-base-100 px-3 py-2 shadow-xl border border-base-300">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-8 w-8 text-primary"
        >
          <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
        </svg>
        <span className="text-sm font-medium truncate max-w-[150px]">
          {folder?.name ?? "Folder"}
        </span>
      </div>
    );
  }

  if (dragType === "image" || dragType === "playlist-item") {
    const count = dragIds.length;
    const firstImage = imagesMap.get(dragIds[0]);
    const thumbSrc = firstImage ? getThumbnailSrc(firstImage) : undefined;

    if (count === 1) {
      return (
        <div
          className="relative rounded-lg shadow-xl overflow-hidden border-2 border-primary/40"
          style={{ transform: "rotate(2deg)" }}
        >
          {thumbSrc ? (
            <img
              src={thumbSrc}
              alt={firstImage?.name ?? ""}
              className="h-20 w-auto max-w-[120px] object-cover"
              draggable={false}
            />
          ) : (
            <div className="h-20 w-20 bg-base-200 flex items-center justify-center text-xs">
              Image
            </div>
          )}
        </div>
      );
    }

    const secondImage = dragIds.length > 1 ? imagesMap.get(dragIds[1]) : null;
    const secondSrc = secondImage ? getThumbnailSrc(secondImage) : undefined;

    return (
      <div className="relative" style={{ width: 100, height: 80 }}>
        {secondSrc && (
          <div
            className="absolute rounded-lg shadow-md overflow-hidden border border-base-300 opacity-70"
            style={{ transform: "rotate(-4deg)", top: 4, left: 4 }}
          >
            <img
              src={secondSrc}
              alt=""
              className="h-16 w-auto max-w-[90px] object-cover"
              draggable={false}
            />
          </div>
        )}
        <div
          className="absolute rounded-lg shadow-xl overflow-hidden border-2 border-primary/40"
          style={{ transform: "rotate(2deg)", top: 0, left: 0 }}
        >
          {thumbSrc ? (
            <img
              src={thumbSrc}
              alt={firstImage?.name ?? ""}
              className="h-16 w-auto max-w-[90px] object-cover"
              draggable={false}
            />
          ) : (
            <div className="h-16 w-16 bg-base-200" />
          )}
        </div>
        <div
          className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-content text-xs font-bold shadow-md"
          style={{ zIndex: 10 }}
        >
          {count}
        </div>
      </div>
    );
  }

  return null;
}
