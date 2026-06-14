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
  countObjectsAssignedToTodoItem,
  getObjectTodoStatus,
  getSelectedSubItem,
  hasSubItems,
  Object as ProjectObject,
  objectsAssignedToAnyTodoItems,
  safeTodoItemId,
  selectedTodoItemsAssignedOnObject,
  sortObjectsByStoredOrder,
  sortTodoItems,
  todoItemId,
  TodoItem,
  todoItemsWithAssignments,
} from '@models';
import { TranslationService } from '@services/translation.service';

@Component({
  selector: 'app-project-todo-assignment-verify-panel',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './project-todo-assignment-verify-panel.component.html',
  styleUrl: './project-todo-assignment-verify-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTodoAssignmentVerifyPanelComponent {
  #translationService = inject(TranslationService);

  todoItems = input<TodoItem[]>([]);
  objects = input<ProjectObject[]>([]);
  embedded = input(false);

  backRequested = output<void>();

  selectedTodoItemIds = signal<string[]>([]);

  readonly sortedTodoItems = computed(() => sortTodoItems(this.todoItems()));
  readonly sortedObjects = computed(() => sortObjectsByStoredOrder(this.objects()));
  readonly trackTodoItemId = safeTodoItemId;

  readonly assignedTodoItems = computed(() =>
    todoItemsWithAssignments(this.sortedTodoItems(), this.sortedObjects()),
  );

  readonly selectedTodoIdSet = computed(() => new Set(this.selectedTodoItemIds()));

  readonly matchingObjects = computed(() =>
    objectsAssignedToAnyTodoItems(this.sortedObjects(), this.selectedTodoItemIds()),
  );

  readonly hasChecklistSelection = computed(() => this.selectedTodoItemIds().length > 0);

  readonly allAssignedChecklistsSelected = computed(() => {
    const assigned = this.assignedTodoItems();
    const selected = this.selectedTodoItemIds();
    if (!assigned.length) {
      return false;
    }
    return assigned.every((item) => selected.includes(todoItemId(item)));
  });

  objectLabel(object: ProjectObject): string {
    const parts = [
      object.address?.house_number,
      object.address?.level,
      object.address?.door_number,
    ].filter((part) => !!part?.trim());
    if (parts.length) return parts.join(', ');
    if (object.prefix?.trim()) return object.prefix.trim();
    return object._id?.$oid ?? '';
  }

  assignedObjectCount(item: TodoItem): number {
    return countObjectsAssignedToTodoItem(this.sortedObjects(), todoItemId(item));
  }

  matchingChecklistsForObject(object: ProjectObject): TodoItem[] {
    return selectedTodoItemsAssignedOnObject(
      object,
      this.sortedTodoItems(),
      this.selectedTodoIdSet(),
    );
  }

  isChecklistSelected(item: TodoItem): boolean {
    return this.selectedTodoItemIds().includes(todoItemId(item));
  }

  toggleChecklist(item: TodoItem, checked: boolean): void {
    const id = todoItemId(item);
    const current = this.selectedTodoItemIds();
    if (checked) {
      if (!current.includes(id)) {
        this.selectedTodoItemIds.set([...current, id]);
      }
      return;
    }
    this.selectedTodoItemIds.set(current.filter((value) => value !== id));
  }

  toggleSelectAllAssignedChecklists(): void {
    if (this.allAssignedChecklistsSelected()) {
      this.selectedTodoItemIds.set([]);
      return;
    }
    this.selectedTodoItemIds.set(this.assignedTodoItems().map((item) => todoItemId(item)));
  }

  assignmentDetail(object: ProjectObject, item: TodoItem): string {
    const entries = object.todo_entries;
    if (hasSubItems(item)) {
      const sub = getSelectedSubItem(entries, item);
      return sub?.title?.trim() ?? '—';
    }
    const status = getObjectTodoStatus(entries, todoItemId(item));
    if (status === 'finished') {
      return this.#translationService.instant('todos.statusFinished');
    }
    return this.#translationService.instant('todos.statusUnderProcess');
  }

  back(): void {
    this.backRequested.emit();
  }
}
