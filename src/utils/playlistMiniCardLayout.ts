/** Responsive widths shared by playlist strip tiles (mini cards + gallery-drop ghost). */
export function miniPlaylistStripTileWidths(viewportCompact: boolean): string {
  return viewportCompact
    ? "w-24 sm:w-28 md:w-32 lg:w-36 xl:w-40"
    : "w-28 sm:w-32 md:w-40 lg:w-44 xl:w-48";
}
