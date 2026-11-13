import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import {
  editableText,
  restoreEditableSelection,
  editableSelection,
} from '../../utils/checklist-editable';
import { ChecklistNoteEditorComponent } from './checklist-note-editor.component';
import { ChecklistNoteContentComponent } from './checklist-note-content.component';

function selectText(editor: HTMLElement, start: number, end: number): void {
  editor.focus();
  restoreEditableSelection(editor, { start, end });
  editor.dispatchEvent(new Event('keyup'));
}

describe('ChecklistNoteEditorComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [ChecklistNoteEditorComponent, TranslateModule.forRoot()],
      providers: [provideZonelessChangeDetection()],
    }),
  );

  async function editorWith(text: string) {
    const fixture = TestBed.createComponent(ChecklistNoteEditorComponent);
    fixture.componentRef.setInput('note', text);
    fixture.componentInstance.formatsChange.subscribe((formats) =>
      fixture.componentRef.setInput('formats', formats),
    );
    fixture.componentInstance.noteChange.subscribe((note) =>
      fixture.componentRef.setInput('note', note),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      fixture,
      editor: fixture.nativeElement.querySelector('[role=textbox]') as HTMLDivElement,
    };
  }

  it('highlights the exact selected text in the editor without changing the note or showing content below it', async () => {
    const { fixture, editor } = await editorWith('Please repair door today');
    selectText(editor, 7, 18);
    fixture.componentInstance.toggle('title', editor);
    fixture.detectChanges();
    expect(fixture.componentInstance.formats()).toEqual([
      jasmine.objectContaining({
        text: 'Please repair door today',
        start: 7,
        end: 18,
        checklist: true,
      }),
    ]);
    expect(fixture.nativeElement.querySelector('.marked').textContent).toBe('repair door');
    expect(editableText(editor)).toBe('Please repair door today');
    expect(fixture.nativeElement.querySelector('.editor-surface').nextElementSibling).toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        'fieldset, input[type=checkbox], app-checklist-note-content, b',
      ),
    ).toBeNull();
    selectText(editor, 7, 18);
    fixture.componentInstance.toggle('title', editor);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.marked')).toBeNull();
  });

  it('supports separate marked passages in one paragraph and a whole paragraph from the mobile caret', async () => {
    const { fixture, editor } = await editorWith('Repair door and window');
    selectText(editor, 0, 11);
    fixture.componentInstance.toggle('title', editor);
    fixture.detectChanges();
    selectText(editor, 16, 22);
    fixture.componentInstance.toggle('title', editor);
    fixture.detectChanges();
    expect(
      [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.marked')].map(
        (mark) => mark.textContent,
      ),
    ).toEqual(['Repair door', 'window']);
    selectText(editor, 2, 2);
    fixture.componentInstance.toggle('title', editor);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.marked').textContent).toBe(editableText(editor));
    const button = fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement;
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });

  it('marks selected rows safely and scrolls the actual formatted text without a mirror', async () => {
    const { fixture, editor } = await editorWith(
      '<img src=x onerror=alert(1)>\n' + 'Repair window\n'.repeat(30),
    );
    selectText(editor, 0, editableText(editor).length);
    fixture.componentInstance.toggle('title', editor);
    fixture.detectChanges();
    expect(fixture.componentInstance.formats().length).toBe(31);
    expect(new Set(fixture.componentInstance.formats().map((format) => format.group_id)).size).toBe(
      1,
    );
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    editor.style.height = '150px';
    editor.scrollTop = 80;
    expect(editor.scrollTop).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector('.highlights, textarea')).toBeNull();
    expect(editableSelection(editor)).toEqual(
      jasmine.objectContaining({ start: 0, end: editableText(editor).length }),
    );
  });

  it('keeps the whole selection in one group when extending an existing mark across a newline', async () => {
    const { fixture, editor } = await editorWith('Repair door\nRepair window');
    selectText(editor, 0, 11);
    fixture.componentInstance.toggle('title', editor);
    fixture.detectChanges();
    selectText(editor, 0, editableText(editor).length);
    fixture.componentInstance.toggle('title', editor);
    fixture.detectChanges();
    const marks = fixture.componentInstance.formats();
    expect(marks.length).toBe(2);
    expect(new Set(marks.map((mark) => mark.group_id)).size).toBe(1);
    expect(marks.every((mark) => mark.checklist)).toBeTrue();
  });

  it('has exactly two grouped icon controls with accessible help and pairs a note with its title', async () => {
    const { fixture, editor } = await editorWith(
      'Repair door\nCheck the lock\nRepair window\nReplace handle',
    );
    const buttons = fixture.nativeElement.querySelectorAll(
      '.format-buttons button',
    ) as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBe(2);
    expect(buttons[0].getAttribute('title')).toBe('noteChecklist.titleHelp');
    expect(buttons[1].disabled).toBeTrue();
    selectText(editor, 0, 11);
    buttons[0].click();
    fixture.detectChanges();
    const titleGroup = fixture.componentInstance.formats()[0].group_id;
    selectText(editor, 12, 26);
    fixture.componentInstance.captureSelection(editor);
    fixture.detectChanges();
    expect(buttons[1].disabled).toBeFalse();
    buttons[1].click();
    fixture.detectChanges();
    const note = fixture.componentInstance.formats().find((mark) => mark.checklist_note)!;
    expect(note.group_id).toBe(titleGroup);
    expect(fixture.nativeElement.querySelector('.note-mark').textContent).toBe('Check the lock');
    expect(editableText(editor)).toBe('Repair door\nCheck the lock\nRepair window\nReplace handle');
    expect(buttons[1].querySelector('app-icon')).not.toBeNull();
    expect(buttons[1].getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });

  it('associates notes with the nearest title and prevents orphan notes and crossing another title', async () => {
    const { fixture, editor } = await editorWith('Door\nLock\nWindow\nHandle');
    const mark = (kind: 'title' | 'note', start: number, end: number) => {
      selectText(editor, start, end);
      fixture.componentInstance.toggle(kind, editor);
      fixture.detectChanges();
    };
    mark('note', 5, 9);
    expect(fixture.componentInstance.formats()).toEqual([]);
    mark('title', 0, 4);
    mark('title', 10, 16);
    mark('note', 5, 23); // Would cross Window.
    expect(fixture.componentInstance.formats().some((m) => m.checklist_note)).toBeFalse();
    mark('note', 17, 23);
    const window = fixture.componentInstance.formats().find((m) => m.line === 2)!;
    expect(fixture.componentInstance.formats().find((m) => m.checklist_note)?.group_id).toBe(
      window.group_id,
    );
    mark('note', 17, 23); // Remove just the note.
    expect(fixture.componentInstance.formats().length).toBe(2);
    mark('note', 5, 9);
    mark('title', 0, 4); // Remove the title and its own note, leaving Window.
    expect(fixture.componentInstance.formats().map((m) => m.text)).toEqual(['Window']);
  });

  it('replaces a multiline Unicode note and preserves the group when extending its title', async () => {
    const { fixture, editor } = await editorWith(
      'Door repair\nSkontrolovať 🚪\nNew note\nMore detail',
    );
    const mark = (kind: 'title' | 'note', start: number, end: number) => {
      selectText(editor, start, end);
      fixture.componentInstance.toggle(kind, editor);
      fixture.detectChanges();
    };
    mark('title', 0, 4);
    const id = fixture.componentInstance.formats()[0].group_id;
    mark('note', 12, editableText(editor).indexOf('\nNew'));
    mark('title', 0, 11);
    expect(fixture.componentInstance.formats().every((m) => m.group_id === id)).toBeTrue();
    mark('note', editableText(editor).indexOf('New'), editableText(editor).length);
    const notes = fixture.componentInstance.formats().filter((m) => m.checklist_note);
    expect(notes.map((m) => m.text)).toEqual(['New note', 'More detail']);
    expect(notes.every((m) => m.group_id === id)).toBeTrue();
    fixture.componentRef.setInput('disabled', true);
    mark('title', 0, 11);
    expect(fixture.componentInstance.formats().length).toBe(3);
  });

  it('renders real bold, larger titles and indented dash notes without adding prefixes to saved text', async () => {
    const text = 'Door\nCheck the lock';
    const { fixture, editor } = await editorWith(text);
    selectText(editor, 0, 4);
    fixture.componentInstance.toggle('title', editor);
    fixture.detectChanges();
    const title = editor.querySelector<HTMLElement>('.title-mark')!;
    expect(Number(getComputedStyle(title).fontWeight)).toBeGreaterThanOrEqual(700);
    expect(parseFloat(getComputedStyle(title).fontSize)).toBeGreaterThan(
      parseFloat(getComputedStyle(editor).fontSize),
    );
    expect(fixture.nativeElement.querySelector('.title-button').getAttribute('aria-pressed')).toBe(
      'true',
    );
    selectText(editor, 5, text.length);
    fixture.componentInstance.toggle('note', editor);
    fixture.detectChanges();
    const dash = editor.querySelector<HTMLElement>('[data-decoration]')!;
    expect(dash.textContent).toBe('–');
    expect(dash.getAttribute('aria-hidden')).toBe('true');
    expect(parseFloat(getComputedStyle(dash.parentElement!).paddingInlineStart)).toBeGreaterThan(0);
    expect(editableText(editor)).toBe(text);
    expect(fixture.componentInstance.note()).toBe(text);
    expect(editableSelection(editor)).toEqual(
      jasmine.objectContaining({ start: 5, end: text.length }),
    );
    expect(fixture.nativeElement.querySelector('.note-button').getAttribute('aria-pressed')).toBe(
      'true',
    );

    const view = TestBed.createComponent(ChecklistNoteContentComponent);
    view.componentRef.setInput('note', text);
    view.componentRef.setInput('formats', fixture.componentInstance.formats());
    view.detectChanges();
    const readOnlyTitle = view.nativeElement.querySelector('.title-mark') as HTMLElement;
    expect(Number(getComputedStyle(readOnlyTitle).fontWeight)).toBeGreaterThanOrEqual(700);
    const row = view.nativeElement.querySelector('.note-row--note') as HTMLElement;
    expect(getComputedStyle(row, '::before').content).toContain('–');
  });

  it('keeps the caret and pairing when typing, and supports undo and redo after repainting', async () => {
    const { fixture, editor } = await editorWith('Door\nLock');
    selectText(editor, 0, 4);
    fixture.componentInstance.toggle('title', editor);
    fixture.detectChanges();
    selectText(editor, 5, 9);
    fixture.componentInstance.toggle('note', editor);
    fixture.detectChanges();
    const group = fixture.componentInstance.formats()[0].group_id;
    editor.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', bubbles: true }));
    editor.querySelector('.note-mark')!.textContent = 'Handle';
    const range = editor.ownerDocument.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    editor.ownerDocument.getSelection()!.removeAllRanges();
    editor.ownerDocument.getSelection()!.addRange(range);
    editor.dispatchEvent(new InputEvent('input', { inputType: 'insertText', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.note()).toBe('Door\nHandle');
    expect(fixture.componentInstance.formats().every((mark) => mark.group_id === group)).toBeTrue();
    expect(editableSelection(editor)).toEqual(jasmine.objectContaining({ start: 11, end: 11 }));
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    fixture.detectChanges();
    expect(editableText(editor)).toBe('Door\nLock');
    expect(editor.querySelector('[data-decoration]')).not.toBeNull();
    editor.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }),
    );
    fixture.detectChanges();
    expect(editableText(editor)).toBe('Door\nHandle');
  });

  it('preserves newlines, blank lines and literal pasted text, and waits for IME composition', async () => {
    const { fixture, editor } = await editorWith('Door');
    selectText(editor, 4, 4);
    fixture.componentInstance.startComposition(editor);
    editor.innerHTML =
      '<div>Gate</div><div><br></div><div>&lt;b&gt;literal&lt;/b&gt;</div><div><br></div>';
    editor.dispatchEvent(new InputEvent('input', { isComposing: true, bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.note()).toBe('Door');
    fixture.componentInstance.endComposition(new Event('compositionend'), editor);
    fixture.detectChanges();
    expect(fixture.componentInstance.note()).toBe('Gate\n\n<b>literal</b>\n');
    expect(editableText(editor)).toBe('Gate\n\n<b>literal</b>\n');
    expect(editor.querySelector('b')).toBeNull();
    expect(editor.getAttribute('contenteditable')).toBe('plaintext-only');
  });

  it('copies and cuts plain text without decorative dashes and can undo a cut', async () => {
    const { fixture, editor } = await editorWith('Door\nLock');
    selectText(editor, 0, 4);
    fixture.componentInstance.toggle('title', editor);
    fixture.detectChanges();
    selectText(editor, 5, 9);
    fixture.componentInstance.toggle('note', editor);
    fixture.detectChanges();
    selectText(editor, 0, 9);
    const clipboard = new DataTransfer();
    editor.dispatchEvent(
      new ClipboardEvent('copy', { clipboardData: clipboard, bubbles: true, cancelable: true }),
    );
    expect(clipboard.getData('text/plain')).toBe('Door\nLock');
    editor.dispatchEvent(
      new ClipboardEvent('cut', { clipboardData: clipboard, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.note()).toBe('');
    expect(fixture.componentInstance.formats()).toEqual([]);
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    fixture.detectChanges();
    expect(editableText(editor)).toBe('Door\nLock');
    expect(editor.querySelector('.title-mark')).not.toBeNull();
    expect(editor.querySelector('[data-decoration]')).not.toBeNull();
  });

  it('keeps characters typed at the edge of a title or note inside the saved selection', async () => {
    const { fixture, editor } = await editorWith('Door\nLock');
    for (const [kind, start, end] of [
      ['title', 0, 4],
      ['note', 5, 9],
    ] as const) {
      selectText(editor, start, end);
      fixture.componentInstance.toggle(kind, editor);
      fixture.detectChanges();
    }
    selectText(editor, 9, 9);
    editor.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', bubbles: true }));
    const node = editor.querySelector('.note-mark')!.firstChild!;
    node.nodeValue = 'Lock!';
    const range = editor.ownerDocument.createRange();
    range.setStart(node, 5);
    range.collapse(true);
    editor.ownerDocument.getSelection()!.removeAllRanges();
    editor.ownerDocument.getSelection()!.addRange(range);
    editor.dispatchEvent(new InputEvent('input', { inputType: 'insertText', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.formats().find((mark) => mark.checklist_note)?.end).toBe(5);
    expect(editor.querySelector('.note-mark')!.textContent).toBe('Lock!');
    expect(editableText(editor)).toBe('Door\nLock!');
  });
});
