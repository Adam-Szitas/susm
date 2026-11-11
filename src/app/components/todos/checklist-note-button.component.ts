import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Project } from '@models';
import { ModalService } from '@services/modal.service';
import { ChecklistNoteModalComponent } from './checklist-note-modal.component';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';

@Component({
  selector: 'app-checklist-note-button',
  standalone: true,
  imports: [TranslateModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button
    type="button"
    class="button button-outline"
    (click)="open($event)"
    [disabled]="!projectId()"
    [attr.aria-label]="'noteChecklist.open' | translate"
    [title]="'noteChecklist.open' | translate"
  >
    <app-icon [icon]="icons.fileTextDetailed" />
  </button>`,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
    }
    button {
      margin: 0;
      min-inline-size: var(--touch-target-min);
      min-block-size: var(--touch-target-min);
      padding: 0.5rem !important;
    }
    app-icon {
      --icon-size: var(--icon-size-compact);
    }
  `,
})
export class ChecklistNoteButtonComponent {
  protected readonly icons = icons;
  #modal = inject(ModalService);
  projectId = input<string | undefined>();
  changed = output<Project>();

  open(event: Event): void {
    event.stopPropagation();
    if (!this.projectId()) return;
    const result = this.#modal.open({
      title: 'noteChecklist.note',
      wide: true,
      stack: true,
      component: ChecklistNoteModalComponent,
      componentInputs: { projectId: this.projectId() },
    });
    result.childRef?.instance.changed.subscribe((project: Project) => this.changed.emit(project));
  }
}
