export const REORDER_ITEM_SELECTOR = '[data-reorder-id]';

/** Resolve which reorder row is under the user's finger (iOS / touch fallback). */
export function reorderTargetIdFromTouch(
  event: TouchEvent,
  itemSelector: string = REORDER_ITEM_SELECTOR,
): string | null {
  const touch = event.touches[0] ?? event.changedTouches[0];
  if (!touch) return null;
  const element = document.elementFromPoint(touch.clientX, touch.clientY);
  if (!element) return null;
  const item = element.closest<HTMLElement>(itemSelector);
  const id = item?.getAttribute('data-reorder-id');
  return id?.trim() ? id : null;
}
