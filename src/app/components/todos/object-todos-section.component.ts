import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  ObjectTodoEntry,
  TodoItem,
  TodoItemStatus,
  TodoSubItem,
  TodoSubItemColor,
  getObjectTodoStatus,
  getSelectedSubItem,
  getSelectedSubItemId,
  getSubItems,
  hasSubItems,
  isParentTodoAssigned,
  normalizeTodoSubItemColor,
  resolveAssignedTodoItems,
  sortTodoItems,
  todoItemId,
  todoSubItemId,
  updateSelectedSubItem,
  updateTodoEntryStatus,
} from '@models';
import { ProjectStore } from '@store/project.store';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';

@Component({
  selector: 'app-object-todos-section',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './object-todos-section.component.html',
  styleUrl: './object-todos-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectTodosSectionComponent {
  #projectStore = inject(ProjectStore);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);

  objectId = input.required<string>();
  todoItems = input<TodoItem[]>([]);
  todoEntries = input<ObjectTodoEntry[]>([]);
  isAdmin = input(false);

  entriesChanged = output<ObjectTodoEntry[]>();

  saving = signal(false);
  expanded = signal(false);

  readonly sortedItems = computed(() => sortTodoItems(this.todoItems()));

  readonly visibleItems = computed(() =>
    resolveAssignedTodoItems(this.todoItems(), this.todoEntries()),
  );

  readonly visibleCount = computed(() => this.visibleItems().length);

  readonly todoItemId = todoItemId;
  readonly todoSubItemId = todoSubItemId;

  isAssigned(item: TodoItem): boolean {
    return isParentTodoAssigned(this.todoEntries(), todoItemId(item));
  }

  itemHasSubItems(item: TodoItem): boolean {
    return hasSubItems(item);
  }

  subItems(item: TodoItem): TodoSubItem[] {
    return getSubItems(item);
  }

  itemDisplayLabel(item: TodoItem): string {
    const title = item.title?.trim() ?? '';
    const note = item.note?.trim();
    return note ? `${title} (${note})` : title;
  }

  itemStatus(item: TodoItem): TodoItemStatus | null {
    return getObjectTodoStatus(this.todoEntries(), todoItemId(item));
  }

  selectedSubItemId(item: TodoItem): string | null {
    return getSelectedSubItemId(this.todoEntries(), todoItemId(item));
  }

  selectedSubColor(item: TodoItem): TodoSubItemColor {
    const sub = getSelectedSubItem(this.todoEntries(), item);
    return normalizeTodoSubItemColor(sub?.color);
  }

  toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  toggleAssignment(_item: TodoItem, _event: Event): void {}

  setStatus(item: TodoItem, status: TodoItemStatus): void {
    const entries = updateTodoEntryStatus(this.todoEntries(), todoItemId(item), status);
    this.#persist(entries);
  }

  setSelectedSubItem(item: TodoItem, subItemId: string): void {
    const entries = updateSelectedSubItem(this.todoEntries(), item, subItemId);
    this.#persist(entries);
  }

  #persist(entries: ObjectTodoEntry[]): void {
    this.saving.set(true);
    this.#projectStore.updateObjectTodos(this.objectId(), entries).subscribe({
      next: (updated) => {
        this.entriesChanged.emit(updated.todo_entries ?? []);
        this.saving.set(false);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('todos.objectUpdateFailed'),
        );
        this.saving.set(false);
      },
    });
  }
}
