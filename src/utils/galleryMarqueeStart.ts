/**
 * When false, left-button drag may start a gallery marquee selection from this target.
 * When true, the pointer is on a thumbnail, folder, or an interactive / filter control.
 */
export function shouldBlockGalleryMarqueeStart(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest("[data-gallery-image-root]") || target.closest("[data-folder-card]")) {
    return true;
  }
  if (target.closest("[data-prevent-gallery-marquee]")) return true;
  if (
    target.closest("input, textarea, select, button, a[href], label, summary, [contenteditable]")
  ) {
    return true;
  }
  if (
    target.closest(
      "[role=button], [role=menuitem], [role=option], [role=menu], [role=listbox], [role=combobox], [role=slider]",
    )
  ) {
    return true;
  }
  return false;
}
