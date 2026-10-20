import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  afterNextRender,
  inject,
  input,
  viewChild,
  ElementRef,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  TODO_SUB_ITEM_COLORS,
  TodoItem,
  TodoSubItem,
  TodoSubItemColor,
  normalizeTodoSubItemColor,
  todoItemId,
  todoSubItemId,
} from '@models';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { TrashIconComponent } from '../shared/trash-icon.component';

interface TodoItemPayload {
  id: string | null;
  title: string;
  note: string | null;
  sub_items: { id: string | null; title: string; color: TodoSubItemColor }[];
}

/** Add or edit one project checklist: title, note, and colored sub-items. */
@Component({
  selector: 'app-project-todo-item-editor-modal',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, TrashIconComponent],
  templateUrl: './project-todo-item-editor-modal.component.html',
  styleUrl: './project-todo-item-editor-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTodoItemEditorModalComponent {
  #fb = inject(FormBuilder);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #projectStore = inject(ProjectStore);
  #cdr = inject(ChangeDetectorRef);

  projectId = input.required<string>();
  /** Null creates a checklist. A value edits that checklist. */
  todoItem = input<TodoItem | null>(null);
  /** Fallback list if the store has not loaded the project yet. */
  existingItems = input<TodoItem[]>([]);

  readonly colorOptions = TODO_SUB_ITEM_COLORS;
  readonly form: FormGroup;
  saving = false;

  private titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  constructor() {
    this.form = this.#fb.group({
      title: ['', Validators.required],
      note: [''],
      subItems: this.#fb.array([]),
    });

    afterNextRender(() => {
      const item = this.todoItem();
      if (item) {
        this.form.patchValue({
          title: item.title ?? '',
          note: item.note ?? '',
        });
        for (const sub of item.sub_items ?? []) {
          this.subItems.push(this.#createSubItemGroup(sub));
        }
        this.#cdr.markForCheck();
      }
      this.titleInput()?.nativeElement.focus();
    });
  }

  get subItems(): FormArray {
    return this.form.get('subItems') as FormArray;
  }

  addSubItem(): void {
    this.subItems.push(this.#createSubItemGroup());
    this.#cdr.markForCheck();
  }

  removeSubItem(index: number): void {
    this.subItems.removeAt(index);
    this.#cdr.markForCheck();
  }

  setSubItemColor(index: number, color: TodoSubItemColor): void {
    this.subItems.at(index).get('color')?.setValue(color);
    this.#cdr.markForCheck();
  }

  colorLabel(color: TodoSubItemColor): string {
    return `todos.color${color.charAt(0).toUpperCase()}${color.slice(1)}`;
  }

  close(): void {
    this.#modalService.close();
  }

  save(): void {
    this.form.updateValueAndValidity({ emitEvent: false });
    const draft = this.#draftPayload();
    if (!draft.title) {
      this.#notificationService.showError(this.#translationService.instant('todos.itemTitleRequired'));
      this.titleInput()?.nativeElement.focus();
      this.#cdr.markForCheck();
      return;
    }

    const editingId = this.#editingId();
    const current = this.#currentItems().map((item) => this.#toPayload(item));
    if (editingId) {
      const index = current.findIndex((item) => item.id === editingId);
      const next = { ...draft, id: editingId };
      if (index === -1) {
        current.push(next);
      } else {
        current[index] = next;
      }
    } else {
      current.push(draft);
    }

    this.saving = true;
    this.#cdr.markForCheck();
    this.#projectStore.updateProjectTodoItems(this.projectId(), current).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('todos.projectListUpdated'),
        );
        this.#modalService.close();
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('todos.projectListUpdateFailed'),
        );
        this.saving = false;
        this.#cdr.markForCheck();
      },
    });
  }

  #editingId(): string | null {
    const item = this.todoItem();
    if (!item) return null;
    return todoItemId(item) || null;
  }

  #currentItems(): TodoItem[] {
    return this.#projectStore.project()?.todo_items ?? this.existingItems();
  }

  #draftPayload(): TodoItemPayload {
    const sub_items = this.subItems.controls
      .map((control) => {
        const group = control as FormGroup;
        const title = String(group.get('title')?.value ?? '').trim();
        if (!title) return null;
        return {
          id: (group.get('id')?.value as string | null) ?? null,
          title,
          color: normalizeTodoSubItemColor(String(group.get('color')?.value ?? '')),
        };
      })
      .filter((sub): sub is TodoItemPayload['sub_items'][number] => sub !== null);

    return {
      id: null,
      title: String(this.form.get('title')?.value ?? '').trim(),
      note: String(this.form.get('note')?.value ?? '').trim() || null,
      sub_items,
    };
  }

  #toPayload(item: TodoItem): TodoItemPayload {
    return {
      id: todoItemId(item) || null,
      title: item.title,
      note: item.note?.trim() || null,
      sub_items: (item.sub_items ?? []).map((sub) => ({
        id: todoSubItemId(sub) || null,
        title: sub.title,
        color: normalizeTodoSubItemColor(sub.color),
      })),
    };
  }

  #createSubItemGroup(sub?: TodoSubItem): FormGroup {
    return this.#fb.group({
      id: [sub ? todoSubItemId(sub) : null],
      title: [sub?.title ?? ''],
      color: [normalizeTodoSubItemColor(sub?.color)],
    });
  }
}
