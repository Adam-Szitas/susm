import { Component, Directive, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoteViewportDirective } from './note-viewport.directive';

@Directive({ selector: '[noteEditor]', hostDirectives: [NoteViewportDirective] })
class TestEditor {}

@Component({
  imports: [TestEditor],
  template: '<dialog class="modal-content"><div noteEditor><textarea></textarea></div></dialog>',
})
class NoteDialog {}

describe('note dialog keyboard placement', () => {
  it('tracks the panned visible bottom and restores the dialog when the keyboard closes', async () => {
    const viewport = Object.assign(new EventTarget(), {
      height: window.innerHeight,
      offsetTop: 0,
      scale: 1,
    });
    spyOnProperty(window, 'visualViewport', 'get').and.returnValue(
      viewport as unknown as VisualViewport,
    );
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(NoteDialog);
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialog.showModal();
    dialog.querySelector('textarea')!.focus();
    viewport.height -= 230;
    viewport.offsetTop = 32;
    viewport.dispatchEvent(new Event('resize'));
    expect(dialog.classList.contains('note-keyboard-open')).toBeTrue();
    expect(dialog.style.getPropertyValue('--note-visible-bottom')).toBe(
      viewport.height + 32 + 'px',
    );
    if (matchMedia('(max-width: 768px), (pointer: coarse)').matches) {
      expect(dialog.getBoundingClientRect().bottom).toBeCloseTo(viewport.height + 32, 0);
    }
    viewport.height = window.innerHeight;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event('resize'));
    expect(dialog.classList.contains('note-keyboard-open')).toBeFalse();
    dialog.close();
  });
});
