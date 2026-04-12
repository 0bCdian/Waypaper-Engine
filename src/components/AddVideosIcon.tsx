import type { FC } from "react";

/** Outline video / clip icon — matches AddImagesIcon / AddFoldersIcon scale. */
const AddVideosIcon: FC = () => (
  <svg
    className="m-auto"
    xmlns="http://www.w3.org/2000/svg"
    width={64}
    height={64}
    fill="none"
    viewBox="0 0 24 24"
  >
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}>
      <rect x={2} y={6} width={14} height={12} rx={2} />
      <path d="M18 9v6l5-3-5-3z" fill="none" />
    </g>
  </svg>
);

export default AddVideosIcon;
