import { DestroyRef, inject, signal } from '@angular/core';

const MOBILE_FORM_ACTIONS_QUERY = '(max-width: 768px)';

/** True on viewports ≤768px — edit modal footer shows icon-only buttons. */
export function compactFormActions() {
  const destroyRef = inject(DestroyRef);
  const iconOnly = signal(false);

  if (typeof window === 'undefined') {
    return iconOnly;
  }

  const mq = window.matchMedia(MOBILE_FORM_ACTIONS_QUERY);
  const sync = () => iconOnly.set(mq.matches);
  sync();
  mq.addEventListener('change', sync);
  destroyRef.onDestroy(() => mq.removeEventListener('change', sync));

  return iconOnly;
}
