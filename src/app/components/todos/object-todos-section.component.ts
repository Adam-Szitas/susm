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
  entriesForAssignedParent,
  entriesForUnassignedParent,
  isHiddenFromProtocol,
  isParentTodoAssigned,
  normalizeTodoSubItemColor,
  serializeTodoEntries,
  sortTodoItems,
  todoItemId,
  todoSubItemId,
  updateSelectedSubItem,
  updateTodoEntryHiddenFromProtocol,
  updateTodoEntryStatus,
} from '@models';
import { ProjectStore } from '@store/project.store';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { truncateSelectLabel } from '../../utils/truncate-select-label';

@Component({
  selector: 'app-object-todos-section',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, IconComponent],
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
  isAdmin = input(false);

  entriesChanged = output<ObjectTodoEntry[]>();

  saving = signal(false);
  expanded = signal(false);
  readonly #optimisticEntries = signal<ObjectTodoEntry[] | null>(null);

  readonly sortedItems = computed(() => sortTodoItems(this.todoItems()));

  readonly assignedCount = computed(
    () =>
      this.sortedItems().filter((item) =>
        isParentTodoAssigned(this.#activeEntries(), todoItemId(item)),
      ).length,
  );

  readonly visibleCount = computed(() => this.assignedCount());

  readonly todoItemId = todoItemId;
  readonly todoSubItemId = todoSubItemId;
  readonly truncateSelectLabel = truncateSelectLabel;

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

  isAssigned(item: TodoItem): boolean {
    return isParentTodoAssigned(this.#activeEntries(), todoItemId(item));
  }

  isHiddenInProtocol(item: TodoItem): boolean {
    return isHiddenFromProtocol(this.#activeEntries(), todoItemId(item));
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

  statusLabel(status: TodoItemStatus): string {
    return status === 'finished'
      ? this.#translationService.instant('todos.statusFinished')
      : this.#translationService.instant('todos.statusUnderProcess');
  }

  selectedSubItemTitle(item: TodoItem): string {
    const sub = getSelectedSubItem(this.#activeEntries(), item);
    return sub?.title?.trim() ?? '';
  }

  selectedStatusTitle(item: TodoItem): string {
    const status = this.itemStatus(item);
    return status ? this.statusLabel(status) : '';
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

  toggleAssignment(item: TodoItem, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const parentId = todoItemId(item);
    const entries = checked
      ? entriesForAssignedParent(item, this.#activeEntries())
      : entriesForUnassignedParent(parentId, this.#activeEntries());
    this.#optimisticEntries.set(entries);
    this.#persist(entries);
  }

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
        const entries = updated.todo_entries ?? [];
        this.#optimisticEntries.set(entries);
        this.entriesChanged.emit(entries);
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
