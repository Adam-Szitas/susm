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
  getObjectTodoStatus,
  isTodoAssigned,
  sortTodoItems,
  todoEntryItemId,
  todoItemId,
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

  readonly sortedItems = computed(() => sortTodoItems(this.todoItems()));

  readonly visibleItems = computed(() => {
    const items = this.sortedItems();
    if (this.isAdmin()) {
      return items;
    }
    const assignedIds = new Set(this.todoEntries().map((e) => todoEntryItemId(e)));
    return items.filter((item) => assignedIds.has(todoItemId(item)));
  });

  isAssigned(item: TodoItem): boolean {
    return isTodoAssigned(this.todoEntries(), todoItemId(item));
  }

  itemStatus(item: TodoItem): TodoItemStatus | null {
    return getObjectTodoStatus(this.todoEntries(), todoItemId(item));
  }

  toggleAssignment(item: TodoItem, event: Event): void {
    if (!this.isAdmin()) return;
    const checked = (event.target as HTMLInputElement).checked;
    const itemId = todoItemId(item);
    let entries = [...this.todoEntries()];

    if (checked) {
      if (!entries.some((e) => todoEntryItemId(e) === itemId)) {
        entries.push({ todo_item_id: itemId, status: 'pending' });
      }
    } else {
      entries = entries.filter((e) => todoEntryItemId(e) !== itemId);
    }

    this.#persist(entries);
  }

  setStatus(item: TodoItem, status: TodoItemStatus): void {
    const itemId = todoItemId(item);
    const entries = this.todoEntries().map((entry) =>
      todoEntryItemId(entry) === itemId ? { ...entry, status } : entry,
    );
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
