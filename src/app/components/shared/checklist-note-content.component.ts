import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NoteLine, noteRows } from '../../models/note-line.model';

@Component({
  selector: 'app-checklist-note-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (row of rows(); track $index) {
    <div class="note-row" [class.note-row--note]="row.hasNote">
      @for (part of row.parts; track $index) {
        @if (part.marked) {
          <mark [class.title-mark]="!part.note" [class.note-mark]="part.note">{{ part.text }}</mark>
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
    mark.note-mark {
      background: #f8eeee;
      box-shadow: none;
    }
    mark.title-mark {
      font-size: 1.2em;
      font-weight: 700;
      line-height: 1.4;
      background: #fff3cf;
      box-shadow: none;
    }
    .note-row--note {
      position: relative;
      padding-inline-start: 1.4em;
      border-inline-start: 2px solid #e7d1d1;
    }
    .note-row--note::before {
      content: '–';
      position: absolute;
      inset-inline-start: 0.35em;
      color: var(--primary-default, #9d0000);
    }
  `,
})
export class ChecklistNoteContentComponent {
  note = input('');
  formats = input<NoteLine[]>([]);
  rows = computed(() => noteRows(this.note(), this.formats()));
}
