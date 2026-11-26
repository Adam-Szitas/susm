import {
  ChecklistDraft,
  checklistDrafts,
  hasChecklistDrafts,
  writeDraft,
} from '../../utils/checklist-drafts';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  HostListener,
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
  draft = signal<ChecklistDraft | null>(null);
  deviceStatus = signal('');
  deviceBusy = signal(false);
  conflict = signal(false);

  private timer?: ReturnType<typeof setTimeout>;
  readonly autoInFlight = signal(false);
  private due = false;
  private touched = false;

  edited(): void {
    this.touched = true;
    this.due = false;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 5000);
  }

  @HostListener('document:visibilitychange')
  visibilityChanged(): void {
    if (document.visibilityState === 'hidden') this.background();
  }

  @HostListener('window:pagehide')
  background(): void {
    if (!this.touched || !this.editing() || !this.dirty()) return;
    void this.keepDraft();
    this.flush();
  }

  @HostListener('window:online')
  flush(): void {
    if (
      !this.touched ||
      !this.editing() ||
      !this.canEdit() ||
      this.conflict() ||
      this.saving() ||
      (!this.dirty() && !this.autoInFlight())
    )
      return;
    clearTimeout(this.timer);
    this.due = true;
    if (!this.autoInFlight()) this.save(true);
  }

  private dirty(): boolean {
    return (
      this.note() !== (this.current()?.checklist_note ?? '') ||
      JSON.stringify(this.formats()) !== JSON.stringify(this.current()?.checklist_note_lines ?? [])
    );
  }

  private deviceWrite?: Promise<void>;

  keepDraft(): Promise<void> {
    if (this.deviceWrite) return this.deviceWrite;
    this.deviceWrite = this.persistDraft().finally(() => {
      this.deviceWrite = undefined;
    });
    return this.deviceWrite;
  }

  private async persistDraft(): Promise<void> {
    const project = this.current();
    if (!project || !this.canEdit() || this.deviceBusy()) return;
    this.deviceBusy.set(true);
    const draft = this.draft() ?? {
      projectId: this.projectId(),
      name: project.name,
      previous: project.checklist_note ?? null,
      previousFormats: project.checklist_note_lines ?? [],
      revision: '',
    };
    const snapshot = { ...draft, note: this.note(), formats: this.formats() };
    try {
      const revision = await writeDraft(snapshot);
      this.draft.set({ ...snapshot, revision });
      this.deviceStatus.set('Saved on this device.');
    } catch (error) {
      this.deviceStatus.set(String(error));
    } finally {
      this.deviceBusy.set(false);
    }
  }

  private async restoreDraft(project: Project): Promise<void> {
    try {
      const draft = (await checklistDrafts()).find((item) => item.projectId === this.projectId());
      if (!draft || !this.canEdit()) return;
      this.draft.set(draft);
      this.conflict.set(
        draft.previous !== (project.checklist_note ?? null) ||
          JSON.stringify(draft.previousFormats) !==
            JSON.stringify(project.checklist_note_lines ?? []),
      );
      this.note.set(draft.note);
      this.formats.set(draft.formats);
      this.deviceStatus.set('Device draft restored.');
    } catch {
      this.deviceStatus.set('Device storage unavailable.');
    }
  }

  canEdit = computed(() => this.#user.isAdmin() || this.#user.isSuperuser());
  #closeGuard = () => {
    if (this.saving() || this.autoInFlight()) return false;
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
    clearTimeout(this.timer);
    this.#modal.clearCloseGuard(this.#closeGuard);
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.#store
      .loadChecklistNote(this.projectId())
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: async (project) => {
          this.apply(project);
          if (this.canEdit()) {
            this.edit();
            if (hasChecklistDrafts()) await this.restoreDraft(project);
          }
          this.loading.set(false);
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

  save(auto = false): void {
    const project = this.current();
    if (
      this.saving() ||
      this.autoInFlight() ||
      (!auto && this.deviceBusy()) ||
      this.conflict() ||
      !project ||
      !this.canEdit() ||
      !this.editing()
    )
      return;
    clearTimeout(this.timer);
    this.due = false;
    this.autoInFlight.set(auto);
    this.saving.set(!auto);
    this.#store
      .saveChecklistNote(this.projectId(), project, this.note(), this.formats())
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: async (project) => {
          this.apply(project);
          if (auto) {
            if (this.deviceWrite) await this.deviceWrite;
            const draft = this.draft();
            if (draft) {
              const updated = {
                ...draft,
                previous: project.checklist_note ?? null,
                previousFormats: project.checklist_note_lines ?? [],
                note: this.note(),
                formats: this.formats(),
              };
              try {
                const revision = await writeDraft(updated);
                this.draft.set({ ...updated, revision });
              } catch (error) {
                this.deviceStatus.set(String(error));
              }
            }
            this.autoInFlight.set(false);
            if (!this.dirty()) this.touched = false;
            if (this.due) this.flush();
            return;
          }
          const draft = this.draft();
          if (draft) {
            try {
              await writeDraft(draft, true);
            } catch {
              this.#notification.showError('Submitted. The device draft could not be removed.');
            }
          }
          this.editing.set(false);
          this.saving.set(false);
          this.#modal.close();
        },
        error: (error: Error) => {
          this.autoInFlight.set(false);
          this.saving.set(false);
          if (auto) {
            void this.keepDraft();
            this.#notification.showError(
              error.message || 'Autosave failed. Review the note and retry.',
            );
            return;
          }
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
