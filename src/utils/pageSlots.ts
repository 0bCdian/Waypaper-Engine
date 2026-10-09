export type PageSlot = number | "gap-start" | "gap-end";

const SLOTS = 7;

/**
 * Page buttons for the gallery pager. Once there are more than 7 pages it always returns exactly
 * 7 slots (first, last, a window around `current`, gaps as ellipses), so the pager never changes
 * width and Previous/Next stay under the cursor while paging.
 */
export function pageSlots(current: number, total: number): PageSlot[] {
  if (total <= SLOTS) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "gap-end", total];
  if (current >= total - 3)
    return [1, "gap-start", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "gap-start", current - 1, current, current + 1, "gap-end", total];
}
