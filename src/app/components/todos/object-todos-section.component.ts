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
import { TranslateModule } from '@ngx-translate/core';
import {
  ObjectTodoEntry,
  TodoItem,
  entriesForAssignedParent,
  entriesForUnassignedParent,
  isHiddenFromProtocol,
  isParentTodoAssigned,
  serializeTodoEntries,
  sortTodoItems,
  todoItemId,
  updateTodoEntryHiddenFromProtocol,
} from '@models';
import { ProjectStore } from '@store/project.store';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { TodoItemValueControlComponent } from './todo-item-value-control.component';

@Component({
  selector: 'app-object-todos-section',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IconComponent,
    TodoItemValueControlComponent,
  ],
  templateUrl: './object-todos-section.component.html',
  styleUrl: './object-todos-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectTodosSectionComponent {
  protected readonly icons = icons;
  #projectStore = inject(ProjectStore);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);

  objectId = input.required<string>();
  todoItems = input<TodoItem[]>([]);
  todoEntries = input<ObjectTodoEntry[]>([]);

  entriesChanged = output<ObjectTodoEntry[]>();

  saving = signal(false);
  expanded = signal(false);
  assigning = signal(false);
  readonly #optimisticEntries = signal<ObjectTodoEntry[] | null>(null);

  readonly sortedItems = computed(() => sortTodoItems(this.todoItems()));

  readonly assignedItems = computed(() =>
    this.sortedItems().filter((item) =>
      isParentTodoAssigned(this.#activeEntries(), todoItemId(item)),
    ),
  );

  readonly availableItems = computed(() =>
    this.sortedItems().filter(
      (item) => !isParentTodoAssigned(this.#activeEntries(), todoItemId(item)),
    ),
  );

  readonly assignedCount = computed(() => this.assignedItems().length);
  readonly availableCount = computed(() => this.availableItems().length);
  readonly activeEntries = computed(() => this.#optimisticEntries() ?? this.todoEntries());
  readonly todoItemId = todoItemId;

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

  isHiddenInProtocol(item: TodoItem): boolean {
    return isHiddenFromProtocol(this.#activeEntries(), todoItemId(item));
  }

  itemDisplayLabel(item: TodoItem): string {
    const title = item.title?.trim() ?? '';
    const note = item.note?.trim();
    return note ? `${title} (${note})` : title;
  }

  toggleExpanded(): void {
    this.expanded.update((value) => !value);
    if (!this.expanded()) {
      this.assigning.set(false);
    }
  }

  toggleAssigning(): void {
    this.assigning.update((value) => !value);
    if (!this.expanded()) {
      this.expanded.set(true);
    }
  }

  assignItem(item: TodoItem): void {
    const entries = entriesForAssignedParent(item, this.#activeEntries());
    this.#optimisticEntries.set(entries);
    this.#persist(entries);
  }

  unassignItem(item: TodoItem): void {
    const entries = entriesForUnassignedParent(todoItemId(item), this.#activeEntries());
    this.#optimisticEntries.set(entries);
    this.#persist(entries);
  }

  onEntriesChange(entries: ObjectTodoEntry[]): void {
    this.#optimisticEntries.set(entries);
    this.#persist(entries);
  }

  toggleHiddenInProtocol(item: TodoItem): void {
    const parentId = todoItemId(item);
    const hidden = !isHiddenFromProtocol(this.#activeEntries(), parentId);
    const entries = updateTodoEntryHiddenFromProtocol(this.#activeEntries(), parentId, hidden);
    const successMessage = this.#translationService.instant(
      hidden ? 'todos.hiddenFromProtocolSuccess' : 'todos.shownInProtocolSuccess',
      { title: item.title },
    );
    this.#optimisticEntries.set(entries);
    this.#persist(entries, successMessage);
  }

  #activeEntries(): ObjectTodoEntry[] {
    return this.#optimisticEntries() ?? this.todoEntries();
  }

  #persist(entries: ObjectTodoEntry[], successMessage?: string): void {
    this.saving.set(true);
    this.#projectStore.updateObjectTodos(this.objectId(), entries).subscribe({
      next: (updated) => {
        const nextEntries = updated.todo_entries ?? [];
        this.#optimisticEntries.set(nextEntries);
        this.entriesChanged.emit(nextEntries);
        this.saving.set(false);
        if (successMessage) {
          this.#notificationService.showSuccess(successMessage);
        }
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
