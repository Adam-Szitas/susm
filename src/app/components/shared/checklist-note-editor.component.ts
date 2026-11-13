import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  untracked,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import {
  NoteLine,
  noteRows,
  rebaseNoteLines,
  selectedNoteLines,
  pruneChecklistNotes,
} from '../../models/note-line.model';
import {
  EditableSelection,
  editableText,
  editableSelection,
  restoreEditableSelection,
} from '../../utils/checklist-editable';

@Component({
  selector: 'app-checklist-note-editor',
  standalone: true,
  imports: [TranslateModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="format-buttons" role="group" [attr.aria-label]="'noteChecklist.format' | translate">
      <button
        type="button"
        [disabled]="disabled()"
        class="title-button"
        [attr.aria-pressed]="selectedRole() === 'title'"
        [attr.aria-label]="'noteChecklist.title' | translate"
        [title]="'noteChecklist.titleHelp' | translate"
        (pointerdown)="$event.preventDefault()"
        (click)="toggle('title', editor)"
      >
        <app-icon [icon]="icons.flag" [size]="20" />
      </button>
      <button
        type="button"
        class="note-button"
        [attr.aria-pressed]="selectedRole() === 'note'"
        [disabled]="disabled() || !noteTarget()"
        [attr.aria-label]="'noteChecklist.description' | translate"
        [title]="'noteChecklist.descriptionHelp' | translate"
        (pointerdown)="$event.preventDefault()"
        (click)="toggle('note', editor)"
      >
        <app-icon [icon]="icons.fileText" [size]="20" />
      </button>
    </div>
    <p class="hint" [id]="editorId() + '-hint'">{{ 'noteChecklist.hint' | translate }}</p>
    <div class="editor-surface">
      <div
        #editor
        class="editable"
        role="textbox"
        aria-multiline="true"
        [id]="editorId()"
        [attr.contenteditable]="disabled() ? 'false' : 'plaintext-only'"
        [attr.aria-disabled]="disabled()"
        [attr.tabindex]="disabled() ? -1 : 0"
        [attr.aria-label]="'noteChecklist.note' | translate"
        [attr.aria-describedby]="editorId() + '-hint'"
        (beforeinput)="beforeInput($event, editor)"
        (input)="onInput($event, editor)"
        (click)="captureSelection(editor)"
        (keyup)="captureSelection(editor)"
        (keydown)="onKeydown($event, editor)"
        (copy)="copy($event, editor)"
        (cut)="copy($event, editor, true)"
        (compositionstart)="startComposition(editor)"
        (compositionend)="endComposition($event, editor)"
      ></div>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.5rem;
      min-width: 0;
      width: 100%;
    }
    .format-buttons {
      display: inline-flex;
      justify-self: start;
      gap: 0;
      border: 1px solid rgba(157, 0, 0, 0.22);
      border-radius: 0.5rem;
      background: #fffafa;
      padding: 3px;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      min-width: 44px;
      min-height: 44px;
      font: inherit;
      color: var(--primary-default, #9d0000);
      background: transparent;
      border: 0;
      border-radius: 0.4rem;
      padding: 0.45rem 0.65rem;
      cursor: pointer;
    }
    .title-button {
      background: #fff3cf;
    }
    .note-button {
      background: #f4e3e3;
      margin-inline-start: 3px;
    }
    button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    button:hover:not(:disabled) {
      box-shadow: inset 0 0 0 1px currentColor;
    }
    button:focus-visible,
    .editable:focus-visible {
      outline: 2px solid var(--primary-default, #9d0000);
      outline-offset: 2px;
    }
    .editor-surface {
      position: relative;
      min-width: 0;
      background: var(--background-color, white);
      border-radius: 0.4rem;
    }
    .editable {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      min-height: 12rem;
      max-height: 50dvh;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 0.75rem 1rem;
      font: inherit;
      font-size: 1rem;
      line-height: 1.6;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      border: 1px solid var(--border-color, #b7c6dc);
      border-radius: 0.4rem;
      cursor: text;
    }
    .editable[aria-disabled='true'] {
      opacity: 0.65;
      cursor: default;
    }
    button[aria-pressed='true'] {
      box-shadow: inset 0 0 0 2px var(--primary-default, #9d0000);
    }
    .hint {
      margin: 0;
      font-size: 0.85rem;
      color: var(--text-secondary, #5b6575);
    }
  `,
})
export class ChecklistNoteEditorComponent {
  protected readonly icons = icons;
  #destroyRef = inject(DestroyRef);
  private editorRef = viewChild<ElementRef<HTMLDivElement>>('editor');
  note = input('');
  formats = input<NoteLine[]>([]);
  disabled = input(false);
  editorId = input('checklist-note');
  noteChange = output<string>();
  formatsChange = output<NoteLine[]>();
  selection = signal({ start: 0, end: 0 });
  noteTarget = computed(() => this.findNoteTarget(this.selection().start, this.selection().end));

  readonly selectedRole = computed(() => {
    const { start, end } = this.selection();
    let offset = 0;
    for (const [line, text] of this.note().split('\n').entries()) {
      const mark = this.formats().find(
        (mark) =>
          mark.checklist &&
          mark.line === line &&
          mark.text === text &&
          (end > start
            ? offset + (mark.start ?? 0) < end && offset + (mark.end ?? text.length) > start
            : start >= offset + (mark.start ?? 0) && start <= offset + (mark.end ?? text.length)),
      );
      if (mark) return mark.checklist_note ? 'note' : 'title';
      offset += text.length + 1;
    }
    return null;
  });
  #composing = false;
  #repaint = signal(0);
  #pendingSelection: EditableSelection | null = null;
  #undo: { note: string; formats: NoteLine[]; selection: EditableSelection }[] = [];
  #redo: { note: string; formats: NoteLine[]; selection: EditableSelection }[] = [];

  constructor() {
    afterRenderEffect(() => {
      const text = this.note();
      const formats = this.formats();
      this.#repaint();
      const editor = this.editorRef()?.nativeElement;
      if (!editor || this.#composing) return;
      untracked(() => this.render(editor, text, formats));
    });
    const document = inject(ElementRef<HTMLElement>).nativeElement.ownerDocument;
    const selectionChanged = () => {
      const editor = this.editorRef()?.nativeElement;
      if (editor) this.captureSelection(editor);
    };
    document.addEventListener('selectionchange', selectionChanged);
    this.#destroyRef.onDestroy(() =>
      document.removeEventListener('selectionchange', selectionChanged),
    );
  }

  private render(editor: HTMLElement, text: string, formats: NoteLine[]): void {
    const focused = editor.ownerDocument.activeElement === editor;
    const selection = this.#pendingSelection ?? (focused ? editableSelection(editor) : null);
    const scrollTop = editor.scrollTop;
    const fragment = editor.ownerDocument.createDocumentFragment();
    for (const [line, row] of noteRows(text, formats).entries()) {
      const block = editor.ownerDocument.createElement('div');
      block.dataset['editorRow'] = String(line);
      block.style.minHeight = '1.6em';
      const isNote = row.parts.some((part) => part.note);
      if (isNote) {
        block.style.position = 'relative';
        block.style.paddingInlineStart = '1.4em';
        block.style.borderInlineStart = '2px solid #e7d1d1';
        const dash = editor.ownerDocument.createElement('span');
        dash.dataset['decoration'] = '';
        dash.setAttribute('aria-hidden', 'true');
        dash.setAttribute('contenteditable', 'false');
        dash.textContent = '\u2013';
        dash.style.position = 'absolute';
        dash.style.insetInlineStart = '.35em';
        dash.style.color = 'var(--primary-default, #9d0000)';
        block.appendChild(dash);
      }
      for (const part of row.parts) {
        if (!row.text) continue;
        const span = editor.ownerDocument.createElement(
          part.marked && !part.note ? 'strong' : 'span',
        );
        span.textContent = part.text;
        if (part.marked) {
          span.className = part.note ? 'marked note-mark' : 'marked title-mark';
          span.style.borderRadius = '.2em';
          span.style.background = part.note ? '#f8eeee' : '#fff3cf';
          if (!part.note) {
            span.style.fontSize = '1.2em';
            span.style.fontWeight = '700';
            span.style.lineHeight = '1.4';
          }
        }
        block.appendChild(span);
      }
      if (!row.text) block.appendChild(editor.ownerDocument.createElement('br'));
      fragment.appendChild(block);
    }
    editor.replaceChildren(fragment);
    if (selection && focused) restoreEditableSelection(editor, selection);
    this.#pendingSelection = null;
    editor.scrollTop = scrollTop;
  }

  private snapshot() {
    return {
      note: this.note(),
      formats: this.formats().map((mark) => ({ ...mark })),
      selection: this.selection(),
    };
  }

  private remember(): void {
    this.#undo.push(this.snapshot());
    if (this.#undo.length > 100) this.#undo.shift();
    this.#redo = [];
  }

  change(value: string): void {
    if (value === this.note()) return;
    this.remember();
    let formats = rebaseNoteLines(this.note(), value, this.formats());
    const { start, end } = this.selection();
    const delta = value.length - this.note().length;
    const active = this.editorRef()
      ?.nativeElement.ownerDocument.getSelection()
      ?.anchorNode?.parentElement?.closest('.marked');
    // Typing inside a styled passage at its edge should extend that passage, just
    // as typing in its middle does. Text inserted outside it remains unmarked.
    if (
      active &&
      start === end &&
      delta > 0 &&
      !value.slice(start, start + delta).includes('\n') &&
      value.slice(0, start) === this.note().slice(0, start) &&
      value.slice(start + delta) === this.note().slice(start)
    ) {
      formats = formats.map((mark) => {
        const before = this.formats().find((old) => old.id === mark.id)!;
        const lineStart = this.note()
          .split('\n')
          .slice(0, before.line)
          .reduce((size, row) => size + row.length + 1, 0);
        const local = start - lineStart;
        return before.checklist &&
          !!before.checklist_note === active.classList.contains('note-mark') &&
          (local === (before.start ?? 0) || local === (before.end ?? before.text.length))
          ? { ...mark, start: before.start ?? 0, end: (before.end ?? before.text.length) + delta }
          : mark;
      });
    }
    this.formatsChange.emit(formats);
    this.noteChange.emit(value);
  }

  captureSelection(editor: HTMLElement): void {
    const selection = editableSelection(editor);
    if (selection) this.selection.set(selection);
  }

  beforeInput(event: Event, editor: HTMLElement): void {
    if (this.disabled()) {
      event.preventDefault();
      return;
    }
    const type = (event as InputEvent).inputType;
    if (type === 'historyUndo' || type === 'historyRedo') {
      event.preventDefault();
      this.history(type === 'historyRedo', editor);
    } else this.captureSelection(editor);
  }

  onInput(event: Event, editor: HTMLElement): void {
    if (this.disabled() || this.#composing || (event as InputEvent).isComposing) return;
    this.#pendingSelection = editableSelection(editor);
    this.change(editableText(editor));
    this.#repaint.update((value) => value + 1);
  }

  startComposition(editor: HTMLElement): void {
    this.#composing = true;
    this.captureSelection(editor);
  }

  endComposition(event: Event, editor: HTMLElement): void {
    this.#composing = false;
    this.onInput(event, editor);
  }

  onKeydown(event: KeyboardEvent, editor: HTMLElement): void {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || this.#composing) return;
    const key = event.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    event.preventDefault();
    this.history(key === 'y' || event.shiftKey, editor);
  }

  copy(event: ClipboardEvent, editor: HTMLElement, cut = false): void {
    const selection = editableSelection(editor);
    if (!selection || selection.start === selection.end || !event.clipboardData) return;
    event.preventDefault();
    if (cut && this.disabled()) return;
    event.clipboardData.setData('text/plain', this.note().slice(selection.start, selection.end));
    if (cut) {
      this.captureSelection(editor);
      this.#pendingSelection = { start: selection.start, end: selection.start };
      this.change(this.note().slice(0, selection.start) + this.note().slice(selection.end));
      this.#repaint.update((value) => value + 1);
    }
  }

  private history(redo: boolean, editor: HTMLElement): void {
    if (this.disabled()) return;
    const source = redo ? this.#redo : this.#undo;
    const target = redo ? this.#undo : this.#redo;
    const previous = source.pop();
    if (!previous) return;
    target.push(this.snapshot());
    this.#pendingSelection = previous.selection;
    this.formatsChange.emit(previous.formats);
    this.noteChange.emit(previous.note);
    this.#repaint.update((value) => value + 1);
    editor.focus();
  }

  private publishFormats(formats: NoteLine[], editor: HTMLElement): void {
    this.remember();
    this.#pendingSelection = editableSelection(editor) ?? this.selection();
    this.formatsChange.emit(formats);
    this.#repaint.update((value) => value + 1);
    editor.focus();
  }

  private selectedRanges(start: number, end: number) {
    const selected = selectedNoteLines(this.note(), start, end);
    let offset = 0;
    return this.note()
      .split('\n')
      .map((text, line) => {
        const range = {
          line,
          text,
          start: end > start ? Math.max(0, start - offset) : 0,
          end: end > start ? Math.min(text.length, end - offset) : text.length,
        };
        offset += text.length + 1;
        return range;
      })
      .filter(
        (range) => selected.includes(range.line) && range.text.slice(range.start, range.end).trim(),
      );
  }

  private findNoteTarget(start: number, end: number): string | null {
    const ranges = this.selectedRanges(start, end);
    if (!ranges.length) return null;
    const titles = this.formats().filter((mark) => mark.checklist && !mark.checklist_note);
    const preceding = titles
      .filter((mark) => mark.line < ranges[0].line)
      .sort((a, b) => b.line - a.line || (b.end ?? b.text.length) - (a.end ?? a.text.length));
    const candidate = preceding[0];
    if (!candidate) return null;
    const group = candidate.group_id ?? candidate.id;
    if (titles.some((mark) => mark.line >= ranges[0].line && mark.line <= ranges.at(-1)!.line))
      return null;
    if (titles.some((mark) => (mark.group_id ?? mark.id) === group && mark.line >= ranges[0].line))
      return null;
    return group;
  }

  toggle(kind: 'title' | 'note', editor: HTMLElement): void {
    if (this.disabled()) return;
    this.captureSelection(editor);
    const { start, end } = this.selection();
    const ranges = this.selectedRanges(start, end);
    if (!ranges.length) return;
    const current = this.formats();
    const overlaps = (mark: NoteLine) =>
      mark.checklist &&
      ranges.some(
        (range) =>
          mark.line === range.line &&
          (mark.start ?? 0) < range.end &&
          (mark.end ?? mark.text.length) > range.start,
      );
    const covered = (note: boolean) =>
      ranges.every((range) =>
        current.some(
          (mark) =>
            mark.checklist &&
            !!mark.checklist_note === note &&
            mark.line === range.line &&
            (mark.start ?? 0) <= range.start &&
            (mark.end ?? mark.text.length) >= range.end,
        ),
      );
    let formats = current.map((mark) => ({ ...mark }));
    let group: string;
    if (kind === 'note') {
      const target = this.findNoteTarget(start, end);
      if (
        !target ||
        current.some(
          (mark) =>
            overlaps(mark) && (!mark.checklist_note || (mark.group_id ?? mark.id) !== target),
        )
      )
        return;
      group = target;
      formats = formats.filter(
        (mark) => !(mark.checklist_note && (mark.group_id ?? mark.id) === group),
      );
      if (covered(true)) {
        this.publishFormats(formats, editor);
        return;
      }
    } else {
      const touched = current.filter((mark) => overlaps(mark) && !mark.checklist_note);
      // A note cannot accidentally become a second checklist; unmark it first.
      if (!touched.length && current.some((mark) => overlaps(mark) && mark.checklist_note)) return;
      const groups = new Set(touched.map((mark) => mark.group_id ?? mark.id));
      group = touched[0]?.group_id ?? touched[0]?.id ?? crypto.randomUUID();
      if (covered(false)) {
        this.publishFormats(
          formats.filter((mark) => !groups.has(mark.group_id ?? mark.id)),
          editor,
        );
        return;
      }
      formats = formats.filter(
        (mark) =>
          !groups.has(mark.group_id ?? mark.id) ||
          (mark.checklist_note && (mark.group_id ?? mark.id) === group && !overlaps(mark)),
      );
    }
    for (const range of ranges) {
      formats.push({
        id: crypto.randomUUID(),
        group_id: group,
        ...range,
        checklist: true,
        ...(kind === 'note' ? { checklist_note: true } : {}),
      });
    }
    this.publishFormats(pruneChecklistNotes(formats), editor);
  }
}
