import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';

@Directive()
export class NoteViewportDirective {
  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const dialog = host.closest('dialog');
      const viewport = window.visualViewport;
      if (!dialog || !viewport) return;

      let restingHeight = Math.max(window.innerHeight, viewport.height);
      const sync = () => {
        const editing = host.querySelector('textarea:focus, [contenteditable]:focus');
        const wasOpen = dialog.classList.contains('note-keyboard-open');
        if (!editing && !wasOpen) restingHeight = Math.max(window.innerHeight, viewport.height);
        // Ignore small changes from browser chrome and pinch zoom.
        const keyboardOpen =
          (!!editing || wasOpen) &&
          viewport.scale === 1 &&
          Math.max(restingHeight, window.innerHeight) - viewport.height > 80;
        dialog.classList.toggle('note-keyboard-open', keyboardOpen);
        dialog.style.setProperty(
          '--note-visible-bottom',
          viewport.offsetTop + viewport.height + 'px',
        );
        dialog.style.setProperty('--note-visible-height', viewport.height + 'px');
      };
      const events = new AbortController();
      const options = { signal: events.signal };
      viewport.addEventListener('resize', sync, options);
      viewport.addEventListener('scroll', sync, options);
      host.addEventListener('focusin', sync, options);
      host.addEventListener('focusout', () => queueMicrotask(sync), options);
      sync();
      destroy.onDestroy(() => events.abort());
    });
  }
}
