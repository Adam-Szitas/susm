import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {
  countAssignedTodoItems,
  countObjectsAssignedToTodoItem,
  entriesForAssignedParent,
  entriesForUnassignedParent,
  hasSubItems,
  ObjectTodoEntry,
  Object as ProjectObject,
  formatObjectLabel,
  safeTodoItemId,
  serializeTodoEntries,
  sortTodoItems,
  sortObjectsByStoredOrder,
  TodoItem,
  todoItemId,
} from '@models';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { ProjectStore } from '@store/project.store';

export type AssignmentMobileStep = 'objects' | 'checklist';

@Component({
  selector: 'app-project-todo-assignment-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, IconComponent],
  templateUrl: './project-todo-assignment-panel.component.html',
  styleUrl: './project-todo-assignment-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTodoAssignmentPanelComponent implements OnInit {
  protected readonly icons = icons;
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #projectStore = inject(ProjectStore);
  #cdr = inject(ChangeDetectorRef);

  todoItems = input<TodoItem[]>([]);
  objects = input<ProjectObject[]>([]);
  /** When true, save keeps the parent modal open (e.g. manage-checklist tabs). */
  embedded = input(false);

  saved = output<void>();
  cancelRequested = output<void>();
  verifyRequested = output<void>();
  viewObjectsRequested = output<TodoItem>();

  readonly sortedTodoItems = computed(() => sortTodoItems(this.todoItems()));
  readonly sortedObjects = computed(() => sortObjectsByStoredOrder(this.objects()));
  readonly trackTodoItemId = safeTodoItemId;

  readonly mobileStep = signal<AssignmentMobileStep>('objects');

  searchQuery = signal('');
  selectedObjectIds = signal<string[]>([]);
  saving = signal(false);

  readonly #initialSnapshots = new Map<string, string>();
  readonly #workingEntries = signal(new Map<string, ObjectTodoEntry[]>());

  readonly filteredObjects = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const items = this.sortedObjects();
    if (!query) return items;
    return items.filter((object) => this.objectLabel(object).toLowerCase().includes(query));
  });

  readonly selectedObjects = computed(() => {
    const ids = new Set(this.selectedObjectIds());
    return this.sortedObjects().filter(
      (object) => object._id?.$oid && ids.has(object._id.$oid),
    );
  });

  readonly hasObjectSelection = computed(() => this.selectedObjectIds().length > 0);

  readonly dirtyObjectCount = computed(() => {
    const working = this.#workingEntries();
    let count = 0;
    for (const [objectId, snapshot] of this.#initialSnapshots.entries()) {
      const current = serializeTodoEntries(working.get(objectId));
      if (current !== snapshot) count += 1;
    }
    return count;
  });

  ngOnInit(): void {
    this.#resetWorkingState();
  }

  objectLabel(object: ProjectObject): string {
    return formatObjectLabel(object);
  }

  assignmentSummary(object: ProjectObject): string {
    const objectId = object._id?.$oid;
    if (!objectId) return '0/0';
    const { assigned, total } = countAssignedTodoItems(
      this.entriesForObject(objectId),
      this.sortedTodoItems(),
    );
    return `${assigned}/${total}`;
  }

  isObjectDirty(objectId: string): boolean {
    const snapshot = this.#initialSnapshots.get(objectId);
    if (!snapshot) return false;
    return serializeTodoEntries(this.entriesForObject(objectId)) !== snapshot;
  }

  isObjectDirtyState(object: ProjectObject): boolean {
    const objectId = object._id?.$oid;
    return !!objectId && this.isObjectDirty(objectId);
  }

  isObjectSelected(object: ProjectObject): boolean {
    const objectId = object._id?.$oid;
    return !!objectId && this.selectedObjectIds().includes(objectId);
  }

  /** Click toggles an object in or out of the multi-selection. */
  selectObject(object: ProjectObject): void {
    const objectId = object._id?.$oid;
    if (!objectId) return;
    const current = this.selectedObjectIds();
    if (current.includes(objectId)) {
      this.selectedObjectIds.set(current.filter((id) => id !== objectId));
      return;
    }
    this.selectedObjectIds.set([...current, objectId]);
  }

  goToObjectsStep(): void {
    this.mobileStep.set('objects');
  }

  goToChecklistStep(): void {
    if (!this.hasObjectSelection()) return;
    this.mobileStep.set('checklist');
  }

  selectedObjectsTitle(): string {
    const selected = this.selectedObjects();
    if (selected.length === 1) {
      return this.objectLabel(selected[0]);
    }
    return this.#translationService.instant('todos.selectedObjectCount', {
      count: selected.length,
    });
  }

  entriesForObject(objectId: string): ObjectTodoEntry[] {
    return this.#workingEntries().get(objectId) ?? [];
  }

  isTodoAssigned(objectId: string, item: TodoItem): boolean {
    const parentId = todoItemId(item);
    return this.entriesForObject(objectId).some((entry) => {
      const entryParentId =
        typeof entry.todo_item_id === 'string'
          ? entry.todo_item_id
          : entry.todo_item_id.$oid;
      return entryParentId === parentId;
    });
  }

  itemHasSubItems(item: TodoItem): boolean {
    return hasSubItems(item);
  }

  assignedObjectCount(item: TodoItem): number {
    return countObjectsAssignedToTodoItem(this.sortedObjects(), todoItemId(item));
  }

  viewObjectsForChecklist(item: TodoItem, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.viewObjectsRequested.emit(item);
  }

  isTodoAssignedForSelection(item: TodoItem): boolean {
    const ids = this.selectedObjectIds();
    if (!ids.length) return false;
    return ids.every((objectId) => this.isTodoAssigned(objectId, item));
  }

  isTodoIndeterminateForSelection(item: TodoItem): boolean {
    const ids = this.selectedObjectIds();
    if (!ids.length) return false;
    const assignedCount = ids.filter((objectId) => this.isTodoAssigned(objectId, item)).length;
    return assignedCount > 0 && assignedCount < ids.length;
  }

  toggleAssignmentForSelection(item: TodoItem, checked: boolean): void {
    for (const objectId of this.selectedObjectIds()) {
      this.#toggleAssignmentForObject(objectId, item, checked);
    }
  }

  assignAllForSelected(): void {
    for (const objectId of this.selectedObjectIds()) {
      let entries = this.entriesForObject(objectId);
      for (const item of this.sortedTodoItems()) {
        if (!this.isTodoAssigned(objectId, item)) {
          entries = entriesForAssignedParent(item, entries);
        }
      }
      this.#setEntries(objectId, entries);
    }
  }

  clearAllForSelected(): void {
    for (const objectId of this.selectedObjectIds()) {
      this.#setEntries(objectId, []);
    }
  }

  save(): void {
    const dirtyIds = [...this.#initialSnapshots.keys()].filter((id) => this.isObjectDirty(id));
    if (!dirtyIds.length) {
      if (!this.embedded()) {
        this.cancelRequested.emit();
      }
      return;
    }

    this.saving.set(true);
    const requests = dirtyIds.map((objectId) =>
      this.#projectStore.updateObjectTodos(objectId, this.entriesForObject(objectId)),
    );

    forkJoin(requests)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.#notificationService.showSuccess(
            this.#translationService.instant('todos.assignmentsSaved'),
          );
          this.#commitSnapshots();
          this.saved.emit();
          if (!this.embedded()) {
            this.cancelRequested.emit();
          }
        },
        error: (error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('todos.assignmentsSaveFailed'),
          );
        },
      });
  }

  cancel(): void {
    if (this.dirtyObjectCount() > 0) {
      const confirmed = window.confirm(
        this.#translationService.instant('todos.discardAssignmentChanges'),
      );
      if (!confirmed) return;
    }
    this.cancelRequested.emit();
  }

  #resetWorkingState(): void {
    const map = new Map<string, ObjectTodoEntry[]>();
    this.#initialSnapshots.clear();

    for (const object of this.sortedObjects()) {
      const objectId = object._id?.$oid;
      if (!objectId) continue;
      const entries = [...(object.todo_entries ?? [])];
      map.set(objectId, entries);
      this.#initialSnapshots.set(objectId, serializeTodoEntries(entries));
    }

    this.#workingEntries.set(map);
    this.selectedObjectIds.set([]);
  }

  #toggleAssignmentForObject(objectId: string, item: TodoItem, checked: boolean): void {
    const current = this.entriesForObject(objectId);
    const next = checked
      ? entriesForAssignedParent(item, current)
      : entriesForUnassignedParent(todoItemId(item), current);
    this.#setEntries(objectId, next);
  }

  #commitSnapshots(): void {
    for (const objectId of this.#initialSnapshots.keys()) {
      this.#initialSnapshots.set(
        objectId,
        serializeTodoEntries(this.entriesForObject(objectId)),
      );
    }
  }

  #setEntries(objectId: string, entries: ObjectTodoEntry[]): void {
    const next = new Map(this.#workingEntries());
    next.set(objectId, entries);
    this.#workingEntries.set(next);
    this.#cdr.markForCheck();
  }
}
