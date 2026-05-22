import type { FC } from "react";

/** Outline globe + window — web wallpaper packages. */
const AddWebWallpaperIcon: FC = () => (
  <svg
    className="m-auto"
    xmlns="http://www.w3.org/2000/svg"
    width={64}
    height={64}
    fill="none"
    viewBox="0 0 24 24"
  >
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}>
      <circle cx={12} cy={12} r={9} />
      <ellipse cx={12} cy={12} rx={9} ry={3.5} />
      <path d="M12 3v18" />
    </g>
  </svg>
);

export default AddWebWallpaperIcon;
