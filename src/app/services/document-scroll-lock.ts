let lockCount = 0;
let savedScrollY = 0;

/** Prevent background document scroll while modals/lightboxes are open. */
export function lockDocumentScroll(): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  lockCount += 1;
}

/** Restore document scroll when the last lock is released. */
export function unlockDocumentScroll(): void {
  if (typeof document === 'undefined' || lockCount === 0) {
    return;
  }

  lockCount -= 1;
  if (lockCount > 0) {
    return;
  }

  document.documentElement.classList.remove('modal-open');
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('top');
  document.body.style.removeProperty('left');
  document.body.style.removeProperty('right');
  document.body.style.removeProperty('width');
  window.scrollTo(0, savedScrollY);
}
