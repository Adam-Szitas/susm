import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  serializeTodoEntries,
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
  imports: [CommonModule, FormsModule, TranslateModule],
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
  readonly #optimisticEntries = signal<ObjectTodoEntry[] | null>(null);

  readonly sortedItems = computed(() => sortTodoItems(this.todoItems()));

  readonly visibleItems = computed(() =>
    resolveAssignedTodoItems(this.todoItems(), this.#activeEntries()),
  );

  constructor() {
    effect(() => {
      const external = this.todoEntries();
      const optimistic = this.#optimisticEntries();
      if (
        optimistic &&
        serializeTodoEntries(external) === serializeTodoEntries(optimistic)
      ) {
        this.#optimisticEntries.set(null);
      }
    });
  }

  readonly visibleCount = computed(() => this.visibleItems().length);

  readonly todoItemId = todoItemId;
  readonly todoSubItemId = todoSubItemId;

  isAssigned(item: TodoItem): boolean {
    return isParentTodoAssigned(this.#activeEntries(), todoItemId(item));
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
    return getObjectTodoStatus(this.#activeEntries(), todoItemId(item));
  }

  selectedSubItemId(item: TodoItem): string | null {
    return getSelectedSubItemId(this.#activeEntries(), todoItemId(item));
  }

  selectedSubColor(item: TodoItem): TodoSubItemColor {
    const sub = getSelectedSubItem(this.#activeEntries(), item);
    return normalizeTodoSubItemColor(sub?.color);
  }

  toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  toggleAssignment(_item: TodoItem, _event: Event): void {}

  setStatus(item: TodoItem, status: TodoItemStatus): void {
    const entries = updateTodoEntryStatus(this.#activeEntries(), todoItemId(item), status);
    this.#optimisticEntries.set(entries);
    this.#persist(entries);
  }

  setSelectedSubItem(item: TodoItem, subItemId: string): void {
    const entries = updateSelectedSubItem(this.#activeEntries(), item, subItemId);
    this.#optimisticEntries.set(entries);
    this.#persist(entries);
  }

  #activeEntries(): ObjectTodoEntry[] {
    return this.#optimisticEntries() ?? this.todoEntries();
  }

  #persist(entries: ObjectTodoEntry[]): void {
    this.saving.set(true);
    this.#projectStore.updateObjectTodos(this.objectId(), entries).subscribe({
      next: (updated) => {
        const entries = updated.todo_entries ?? [];
        this.#optimisticEntries.set(entries);
        this.entriesChanged.emit(entries);
        this.saving.set(false);
      },
      error: (error) => {
        this.#optimisticEntries.set(null);
        this.#notificationService.showError(
          error.message || this.#translationService.instant('todos.objectUpdateFailed'),
        );
        this.saving.set(false);
      },
    });
  }
}
