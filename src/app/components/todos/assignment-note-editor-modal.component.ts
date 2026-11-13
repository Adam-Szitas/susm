import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  ObjectTodoEntry,
  TodoItem,
  isParentTodoAssigned,
  todoItemId,
  updateTodoEntryAssignmentNote,
} from '@models';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { UserStore } from '@store/user.store';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';

@Component({
  selector: 'app-assignment-note-editor-modal',
  standalone: true,
  imports: [FormsModule, TranslateModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (submit)="$event.preventDefault(); save()">
      <p class="checklist-title">{{ todoItem().title }}</p>
      <label for="assignment-note-editor">{{ 'todos.assignmentNote' | translate }}</label>
      <textarea
        #noteInput
        id="assignment-note-editor"
        name="note"
        rows="5"
        maxlength="500"
        [ngModel]="draft()"
        (ngModelChange)="draft.set($event)"
        [disabled]="saving()"
        [placeholder]="'todos.assignmentNotePlaceholder' | translate"
        aria-describedby="assignment-note-limit"
      ></textarea>
      <p id="assignment-note-limit" class="hint">{{ draft().length }} / 500</p>
      @if (error()) {
        <p role="alert" class="error">{{ error() }}</p>
      }
      <footer class="actions">
        <button
          type="button"
          class="button button-secondary action-button cancel-action"
          [disabled]="saving()"
          (click)="cancel()"
        >
          <app-icon [icon]="icons.close" /><span>{{ 'common.cancel' | translate }}</span>
        </button>
        <button
          type="submit"
          class="button button-primary action-button submit-action"
          [disabled]="saving() || !canEdit() || draft().length > 500"
          [attr.aria-busy]="saving()"
        >
          <app-icon [icon]="saving() ? icons.loader : icons.check" />
          <span>{{ (saving() ? 'common.saving' : 'common.save') | translate }}</span>
        </button>
      </footer>
    </form>
  `,
  styles: `
    form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .checklist-title {
      margin: 0 0 8px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    label {
      font-size: 0.9rem;
      font-weight: 600;
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 130px;
      resize: vertical;
      border: 1px solid #d0d5dd;
      border-radius: var(--input-border-radius, 8px);
      padding: 10px 12px;
      font: inherit;
      font-size: 16px;
    }
    textarea:focus-visible {
      outline: 2px solid var(--primary-default, #9d0000);
      outline-offset: 2px;
    }
    .hint {
      margin: 0;
      text-align: end;
      font-size: 0.8rem;
      color: #667085;
    }
    .error {
      margin: 0;
      color: var(--primary-default, #9d0000);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }
    .actions button {
      margin: 0;
      min-height: 44px;
    }
  `,
})
export class AssignmentNoteEditorModalComponent implements OnDestroy {
  protected readonly icons = icons;
  #modal = inject(ModalService);
  #store = inject(ProjectStore);
  #user = inject(UserStore);
  #notifications = inject(NotificationService);
  #translations = inject(TranslationService);
  #destroyRef = inject(DestroyRef);
  #closeGuard = () => !this.saving();
  private noteInput = viewChild<ElementRef<HTMLTextAreaElement>>('noteInput');

  objectId = input.required<string>();
  todoItem = input.required<TodoItem>();
  initialNote = input('');
  getEntries = input.required<() => ObjectTodoEntry[]>();
  saved = output<ObjectTodoEntry[]>();
  draft = signal('');
  saving = signal(false);
  error = signal('');
  canEdit = computed(() => this.#user.isAdmin() || this.#user.isSuperuser());

  constructor() {
    afterNextRender(() => {
      this.draft.set(this.initialNote());
      this.#modal.setCloseGuard(this.#closeGuard);
      this.noteInput()?.nativeElement.focus();
    });
  }

  ngOnDestroy(): void {
    this.#modal.clearCloseGuard(this.#closeGuard);
  }

  cancel(): void {
    if (!this.saving()) this.#modal.close();
  }

  save(): void {
    if (!this.canEdit() || this.saving() || this.draft().length > 500) return;
    const current = this.getEntries()();
    const parentId = todoItemId(this.todoItem());
    if (!isParentTodoAssigned(current, parentId)) {
      this.error.set(this.#translations.instant('todos.assignmentNoteUnassigned'));
      return;
    }
    const entries = updateTodoEntryAssignmentNote(current, parentId, this.draft().trim());
    this.error.set('');
    this.saving.set(true);
    this.#store
      .updateObjectTodos(this.objectId(), entries)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (updated) => {
          this.saved.emit(updated.todo_entries ?? []);
          this.saving.set(false);
          this.#modal.close();
          this.#notifications.showSuccess(this.#translations.instant('todos.assignmentNoteSaved'));
        },
        error: () => {
          this.saving.set(false);
          const message = this.#translations.instant('todos.objectUpdateFailed');
          this.error.set(message);
          this.#notifications.showError(message);
        },
      });
  }
}
