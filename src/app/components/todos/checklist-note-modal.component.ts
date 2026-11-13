import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Project } from '@models';
import { NoteLine } from '../../models/note-line.model';
import { ChecklistNoteContentComponent } from '../shared/checklist-note-content.component';
import { ChecklistNoteEditorComponent } from '../shared/checklist-note-editor.component';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { UserStore } from '@store/user.store';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';

@Component({
  selector: 'app-checklist-note-modal',
  standalone: true,
  imports: [
    TranslateModule,
    ChecklistNoteContentComponent,
    ChecklistNoteEditorComponent,
    IconComponent,
  ],
  templateUrl: './checklist-note-modal.component.html',
  styleUrl: './checklist-note-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistNoteModalComponent implements OnDestroy {
  protected readonly icons = icons;
  #store = inject(ProjectStore);
  #modal = inject(ModalService);
  #notification = inject(NotificationService);
  #translation = inject(TranslationService);
  #user = inject(UserStore);
  #destroyRef = inject(DestroyRef);
  projectId = input.required<string>();
  changed = output<Project>();
  current = signal<Project | null>(null);
  loading = signal(true);
  loadFailed = signal(false);
  editing = signal(false);
  saving = signal(false);
  note = signal('');
  formats = signal<NoteLine[]>([]);
  canEdit = computed(() => this.#user.isAdmin() || this.#user.isSuperuser());
  #closeGuard = () => {
    if (this.saving()) return false;
    if (
      !this.editing() ||
      (this.note() === (this.current()?.checklist_note ?? '') &&
        JSON.stringify(this.formats()) ===
          JSON.stringify(this.current()?.checklist_note_lines ?? []))
    )
      return true;
    return this.#modal.openConfirm({
      title: 'todos.unsavedChanges',
      message: 'todos.confirmCloseWithUnsaved',
      confirmText: 'common.close',
      cancelText: 'common.cancel',
      stack: true,
    });
  };

  constructor() {
    afterNextRender(() => {
      this.#modal.setCloseGuard(this.#closeGuard);
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.#modal.clearCloseGuard(this.#closeGuard);
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.#store
      .loadChecklistNote(this.projectId())
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (project) => {
          this.apply(project);
          this.loading.set(false);
          if (this.canEdit()) this.edit();
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  edit(): void {
    if (!this.current() || !this.canEdit()) return;
    this.note.set(this.current()?.checklist_note ?? '');
    this.formats.set((this.current()?.checklist_note_lines ?? []).map((format) => ({ ...format })));
    this.editing.set(true);
  }

  save(): void {
    const project = this.current();
    if (this.saving() || !project || !this.canEdit() || !this.editing()) return;
    this.saving.set(true);
    this.#store
      .saveChecklistNote(this.projectId(), project, this.note(), this.formats())
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (project) => {
          this.apply(project);
          this.editing.set(false);
          this.saving.set(false);
          this.#modal.close();
        },
        error: (error: Error) => {
          this.saving.set(false);
          this.#notification.showError(
            error.message || this.#translation.instant('todos.projectListUpdateFailed'),
          );
        },
      });
  }

  apply(project: Project): void {
    this.current.set(project);
    this.changed.emit(project);
  }

  close(): void {
    this.#modal.close();
  }
}
