import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { ChecklistNoteEditorComponent } from './checklist-note-editor.component';

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
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      fixture,
      editor: fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement,
    };
  }

  it('highlights the exact selected text in the editor without changing the note or showing content below it', async () => {
    const { fixture, editor } = await editorWith('Please repair door today');
    editor.setSelectionRange(7, 18);
    fixture.componentInstance.toggle('checklist', editor);
    fixture.detectChanges();
    expect(fixture.componentInstance.formats()).toEqual([
      jasmine.objectContaining({
        text: 'Please repair door today',
        start: 7,
        end: 18,
        checklist: true,
      }),
    ]);
    expect(fixture.nativeElement.querySelector('mark.marked').textContent).toBe('repair door');
    expect(editor.value).toBe('Please repair door today');
    expect(fixture.nativeElement.querySelector('.editor-surface').nextElementSibling).toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        'fieldset, input[type=checkbox], app-checklist-note-content, b',
      ),
    ).toBeNull();
    editor.setSelectionRange(7, 18);
    fixture.componentInstance.toggle('checklist', editor);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mark.marked')).toBeNull();
  });

  it('supports separate marked passages in one paragraph and a whole paragraph from the mobile caret', async () => {
    const { fixture, editor } = await editorWith('Repair door and window');
    editor.setSelectionRange(0, 11);
    fixture.componentInstance.toggle('checklist', editor);
    fixture.detectChanges();
    editor.setSelectionRange(16, 22);
    fixture.componentInstance.toggle('checklist', editor);
    fixture.detectChanges();
    expect(
      [...fixture.nativeElement.querySelectorAll('mark.marked')].map(
        (mark: any) => mark.textContent,
      ),
    ).toEqual(['Repair door', 'window']);
    editor.setSelectionRange(2, 2);
    fixture.componentInstance.toggle('checklist', editor);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mark.marked').textContent).toBe(editor.value);
    const button = fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement;
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });

  it('marks selected rows safely and keeps highlights aligned when the note scrolls', async () => {
    const { fixture, editor } = await editorWith(
      '<img src=x onerror=alert(1)>\n' + 'Repair window\n'.repeat(30),
    );
    editor.setSelectionRange(0, editor.value.length);
    fixture.componentInstance.toggle('checklist', editor);
    fixture.detectChanges();
    expect(fixture.componentInstance.formats().length).toBe(31);
    expect(new Set(fixture.componentInstance.formats().map((format) => format.group_id)).size).toBe(
      1,
    );
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    editor.scrollTop = 80;
    editor.dispatchEvent(new Event('scroll'));
    expect(fixture.nativeElement.querySelector('.highlights').scrollTop).toBe(editor.scrollTop);
  });

  it('keeps the whole selection in one group when extending an existing mark across a newline', async () => {
    const { fixture, editor } = await editorWith('Repair door\nRepair window');
    editor.setSelectionRange(0, 11);
    fixture.componentInstance.toggle('checklist', editor);
    fixture.detectChanges();
    editor.setSelectionRange(0, editor.value.length);
    fixture.componentInstance.toggle('checklist', editor);
    fixture.detectChanges();
    const marks = fixture.componentInstance.formats();
    expect(marks.length).toBe(2);
    expect(new Set(marks.map((mark) => mark.group_id)).size).toBe(1);
    expect(marks.every((mark) => mark.checklist)).toBeTrue();
  });
});
