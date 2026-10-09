// j/k scroll 100px, gg top, G bottom. Ignored in text fields and with any modifier held.
export function setupVimNavigation() {
  let pendingG = 0;
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
    )
      return;

    if (e.key === "j") window.scrollBy({ top: 100, behavior: "instant" });
    else if (e.key === "k") window.scrollBy({ top: -100, behavior: "instant" });
    else if (e.key === "G") {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    } else if (e.key === "g") {
      if (Date.now() - pendingG < 300) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        pendingG = 0;
      } else pendingG = Date.now();
      return;
    }
    pendingG = 0;
  });
}
