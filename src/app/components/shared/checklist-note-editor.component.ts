import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import {
  NoteLine,
  noteRows,
  rebaseNoteLines,
  selectedNoteLines,
} from '../../models/note-line.model';

@Component({
  selector: 'app-checklist-note-editor',
  standalone: true,
  imports: [FormsModule, TranslateModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="format-buttons" role="group" [attr.aria-label]="'noteChecklist.format' | translate">
      <button
        type="button"
        [disabled]="disabled()"
        [attr.aria-label]="'noteChecklist.bullets' | translate"
        [title]="'noteChecklist.bullets' | translate"
        (pointerdown)="$event.preventDefault()"
        (click)="toggle('bullet', editor)"
      >
        <app-icon [icon]="icons.list" [size]="20" />
        <span class="action-label">{{ 'noteChecklist.bullets' | translate }}</span>
      </button>
      <button
        type="button"
        [disabled]="disabled()"
        [attr.aria-label]="'noteChecklist.mark' | translate"
        [title]="'noteChecklist.mark' | translate"
        (pointerdown)="$event.preventDefault()"
        (click)="toggle('checklist', editor)"
      >
        <app-icon [icon]="icons.flag" [size]="20" />
        <span class="action-label">{{ 'noteChecklist.mark' | translate }}</span>
      </button>
    </div>
    <p class="hint" [id]="editorId() + '-hint'">{{ 'noteChecklist.hint' | translate }}</p>
    <div class="editor-surface">
      <div #highlights class="highlights" aria-hidden="true">
        @for (row of rows(); track $index) {
          <div class="mirror-row" [class.bullet]="row.format?.bullet">
            @for (part of row.parts; track $index) {
              <mark [class.marked]="part.marked">{{ part.text }}</mark>
            }
          </div>
        }
      </div>
      <textarea
        #editor
        [id]="editorId()"
        [attr.aria-label]="'noteChecklist.note' | translate"
        [attr.aria-describedby]="editorId() + '-hint'"
        [ngModel]="note()"
        (ngModelChange)="change($event)"
        (scroll)="syncScroll(editor, highlights)"
        [disabled]="disabled()"
        rows="8"
        [placeholder]="'fileUpload.notePlaceholder' | translate"
      ></textarea>
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
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      min-width: 44px;
      min-height: 44px;
      font: inherit;
      color: inherit;
      background: var(--background-secondary, #f2f5f9);
      border: 1px solid var(--border-color, #b7c6dc);
      border-radius: 0.4rem;
      padding: 0.45rem 0.65rem;
      cursor: pointer;
    }
    button:focus-visible,
    textarea:focus-visible {
      outline: 2px solid var(--primary-default, #9d0000);
      outline-offset: 2px;
    }
    .editor-surface {
      position: relative;
      min-width: 0;
      background: var(--background-color, white);
      border-radius: 0.4rem;
    }
    textarea,
    .highlights {
      box-sizing: border-box;
      width: 100%;
      margin: 0;
      padding: 0.75rem 1rem;
      font: inherit;
      font-size: 1rem;
      font-weight: 400;
      line-height: 1.5;
      letter-spacing: normal;
      tab-size: 4;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      word-break: normal;
      border: 1px solid transparent;
      border-radius: 0.4rem;
    }
    textarea {
      display: block;
      position: relative;
      z-index: 1;
      min-width: 0;
      max-width: 100%;
      min-height: 12rem;
      resize: vertical;
      color: inherit;
      background: transparent;
      border-color: var(--border-color, #b7c6dc);
    }
    .highlights {
      position: absolute;
      inset: 0;
      max-width: 100%;
      overflow: hidden;
      pointer-events: none;
      color: transparent;
    }
    .mirror-row {
      min-height: 1.5em;
      position: relative;
    }
    mark {
      color: transparent;
      background: transparent;
      padding: 0;
    }
    mark.marked {
      background: #ffedb1;
      border-radius: 0.2em;
      box-shadow: inset 0 -1px 0 #dfbc52;
    }
    .bullet::before {
      content: '•';
      position: absolute;
      left: -0.8rem;
      color: var(--text-primary, #333);
    }
    .hint {
      margin: 0;
      font-size: 0.85rem;
      color: var(--text-secondary, #5b6575);
    }
    .action-label {
      display: none;
    }
    @media (min-width: 769px) {
      .action-label {
        display: inline;
      }
    }
    @media (forced-colors: active) {
      mark.marked {
        background: Highlight;
        forced-color-adjust: none;
      }
    }
  `,
})
export class ChecklistNoteEditorComponent {
  protected readonly icons = icons;
  #destroyRef = inject(DestroyRef);
  private editorRef = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  private highlightsRef = viewChild<ElementRef<HTMLDivElement>>('highlights');
  note = input('');
  formats = input<NoteLine[]>([]);
  disabled = input(false);
  editorId = input('checklist-note');
  noteChange = output<string>();
  formatsChange = output<NoteLine[]>();
  rows = computed(() => noteRows(this.note(), this.formats()));

  constructor() {
    afterNextRender(() => {
      const editor = this.editorRef()?.nativeElement;
      const highlights = this.highlightsRef()?.nativeElement;
      if (!editor || !highlights) return;
      const observer = new ResizeObserver(() => this.syncScroll(editor, highlights));
      observer.observe(editor);
      this.syncScroll(editor, highlights);
      this.#destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  syncScroll(editor: HTMLTextAreaElement, highlights: HTMLDivElement): void {
    highlights.scrollTop = editor.scrollTop;
    highlights.scrollLeft = editor.scrollLeft;
    highlights.style.width = `${editor.clientWidth + 2}px`;
  }

  change(value: string): void {
    this.formatsChange.emit(rebaseNoteLines(this.note(), value, this.formats()));
    this.noteChange.emit(value);
  }

  toggle(kind: 'bullet' | 'checklist', editor: HTMLTextAreaElement): void {
    const groupId = crypto.randomUUID();
    const selected = selectedNoteLines(this.note(), editor.selectionStart, editor.selectionEnd);
    const textRows = this.note().split('\n');
    let formats = this.formats().map((format) => ({ ...format }));
    let rangeOffset = 0;
    const selectedRanges = textRows
      .map((text, line) => {
        const hasSelection = editor.selectionEnd > editor.selectionStart;
        const start = hasSelection ? Math.max(0, editor.selectionStart - rangeOffset) : 0;
        const end = hasSelection
          ? Math.min(text.length, editor.selectionEnd - rangeOffset)
          : text.length;
        rangeOffset += text.length + 1;
        return { line, start, end, text };
      })
      .filter(
        (range) => selected.includes(range.line) && range.text.slice(range.start, range.end).trim(),
      );
    const removeMarks =
      kind === 'checklist' &&
      selectedRanges.every((range) =>
        formats.some(
          (format) =>
            format.line === range.line &&
            format.checklist &&
            (format.start ?? 0) <= range.start &&
            (format.end ?? range.text.length) >= range.end,
        ),
      );
    let offset = 0;
    for (let line = 0; line < textRows.length; line++) {
      const text = textRows[line];
      if (!selected.includes(line)) {
        offset += text.length + 1;
        continue;
      }
      const hasSelection = editor.selectionEnd > editor.selectionStart;
      const start = hasSelection ? Math.max(0, editor.selectionStart - offset) : 0;
      const end = hasSelection ? Math.min(text.length, editor.selectionEnd - offset) : text.length;
      if (kind === 'bullet') {
        const existing = formats.find((format) => format.line === line);
        if (existing) existing.bullet = !existing.bullet;
        else formats.push({ id: crypto.randomUUID(), line, text, bullet: true });
      } else {
        const overlaps = formats.filter(
          (format) =>
            format.line === line &&
            format.checklist &&
            (format.start ?? 0) < end &&
            (format.end ?? text.length) > start,
        );
        formats = formats.filter((format) => !overlaps.includes(format));
        if (!removeMarks && text.slice(start, end).trim())
          formats.push({
            id: overlaps[0]?.id ?? crypto.randomUUID(),
            group_id: groupId,
            line,
            text,
            checklist: true,
            start: Math.min(start, ...overlaps.map((format) => format.start ?? 0)),
            end: Math.max(end, ...overlaps.map((format) => format.end ?? text.length)),
            bullet: overlaps.some((format) => format.bullet),
          });
        else if (overlaps.some((format) => format.bullet))
          formats.push({ id: crypto.randomUUID(), line, text, bullet: true });
      }
      offset += text.length + 1;
    }
    this.formatsChange.emit(formats.filter((format) => format.bullet || format.checklist));
    editor.focus();
  }
}
