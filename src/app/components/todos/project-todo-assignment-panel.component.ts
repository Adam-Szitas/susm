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
  entriesForAssignedParent,
  entriesForUnassignedParent,
  hasSubItems,
  ObjectTodoEntry,
  Object as ProjectObject,
  safeTodoItemId,
  serializeTodoEntries,
  sortTodoItems,
  sortObjectsByStoredOrder,
  TodoItem,
  todoItemId,
} from '@models';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';

@Component({
  selector: 'app-project-todo-assignment-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './project-todo-assignment-panel.component.html',
  styleUrl: './project-todo-assignment-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTodoAssignmentPanelComponent implements OnInit {
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

  readonly sortedTodoItems = computed(() => sortTodoItems(this.todoItems()));
  readonly sortedObjects = computed(() => sortObjectsByStoredOrder(this.objects()));
  readonly trackTodoItemId = safeTodoItemId;

  searchQuery = signal('');
  selectedObjectId = signal<string | null>(null);
  saving = signal(false);

  readonly #initialSnapshots = new Map<string, string>();
  readonly #workingEntries = signal(new Map<string, ObjectTodoEntry[]>());

  readonly filteredObjects = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const items = this.sortedObjects();
    if (!query) return items;
    return items.filter((object) => this.objectLabel(object).toLowerCase().includes(query));
  });

  readonly selectedObject = computed(() => {
    const id = this.selectedObjectId();
    if (!id) return null;
    return this.sortedObjects().find((object) => object._id?.$oid === id) ?? null;
  });

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
    const parts = [
      object.address?.house_number,
      object.address?.level,
      object.address?.door_number,
    ].filter((part) => !!part?.trim());
    if (parts.length) return parts.join(', ');
    if (object.prefix?.trim()) return object.prefix.trim();
    return object._id?.$oid ?? '';
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
    return object._id?.$oid === this.selectedObjectId();
  }

  selectObject(object: ProjectObject): void {
    const objectId = object._id?.$oid;
    if (!objectId) return;
    this.selectedObjectId.set(objectId);
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

  toggleAssignment(objectId: string, item: TodoItem, checked: boolean): void {
    const current = this.entriesForObject(objectId);
    const next = checked
      ? entriesForAssignedParent(item, current)
      : entriesForUnassignedParent(todoItemId(item), current);
    this.#setEntries(objectId, next);
  }

  assignAllForSelected(): void {
    const object = this.selectedObject();
    const objectId = object?._id?.$oid;
    if (!objectId) return;

    let entries = this.entriesForObject(objectId);
    for (const item of this.sortedTodoItems()) {
      if (!this.isTodoAssigned(objectId, item)) {
        entries = entriesForAssignedParent(item, entries);
      }
    }
    this.#setEntries(objectId, entries);
  }

  clearAllForSelected(): void {
    const objectId = this.selectedObject()?._id?.$oid;
    if (!objectId) return;
    this.#setEntries(objectId, []);
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

    const first = this.filteredObjects()[0];
    if (first?._id?.$oid) {
      this.selectedObjectId.set(first._id.$oid);
    }
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
