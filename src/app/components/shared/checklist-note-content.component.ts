import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NoteLine, noteRows } from '../../models/note-line.model';

@Component({
  selector: 'app-checklist-note-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (row of rows(); track $index) {
    <div class="note-row" [class.bullet]="row.format?.bullet">
      @for (part of row.parts; track $index) {
        @if (part.marked) {
          <mark>{{ part.text }}</mark>
        } @else {
          <span>{{ part.text }}</span>
        }
      }
    </div>
  }`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .note-row {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      min-height: 1.5em;
    }
    mark {
      color: inherit;
      background: #ffedb1;
      border-radius: 0.2em;
      box-shadow: inset 0 -1px 0 #dfbc52;
    }
    .bullet {
      position: relative;
      padding-inline-start: 1.25em;
    }
    .bullet::before {
      content: '•';
      position: absolute;
      inset-inline-start: 0.25em;
    }
  `,
})
export class ChecklistNoteContentComponent {
  note = input('');
  formats = input<NoteLine[]>([]);
  rows = computed(() => noteRows(this.note(), this.formats()));
}
