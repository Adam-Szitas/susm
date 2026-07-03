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
  entriesForAssignedParent,
  entriesForUnassignedParent,
  isParentTodoAssigned,
  ObjectTodoEntry,
  objectTodoCardClassNames,
  Object as ProjectObject,
  objectsAssignedToAnyTodoItems,
  safeTodoItemId,
  serializeTodoEntries,
  sortObjectsByStoredOrder,
  sortTodoItems,
  TodoItem,
  todoEntryItemId,
  todoItemId,
} from '@models';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { TodoItemValueControlComponent } from './todo-item-value-control.component';

export type ChecklistFirstMobileStep = 'checklists' | 'objects';

@Component({
  selector: 'app-project-todo-assign-to-checklists-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TodoItemValueControlComponent],
  templateUrl: './project-todo-assign-to-checklists-panel.component.html',
  styleUrl: './project-todo-assign-to-checklists-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTodoAssignToChecklistsPanelComponent implements OnInit {
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #projectStore = inject(ProjectStore);
  #cdr = inject(ChangeDetectorRef);

  todoItems = input<TodoItem[]>([]);
  objects = input<ProjectObject[]>([]);
  embedded = input(false);

  saved = output<void>();

  readonly sortedTodoItems = computed(() => sortTodoItems(this.todoItems()));
  readonly sortedObjects = computed(() => sortObjectsByStoredOrder(this.objects()));
  readonly trackTodoItemId = safeTodoItemId;

  readonly mobileStep = signal<ChecklistFirstMobileStep>('checklists');
  checklistSearchQuery = signal('');
  objectSearchQuery = signal('');
  selectedChecklistIds = signal<string[]>([]);
  saving = signal(false);

  readonly #initialSnapshots = new Map<string, string>();
  readonly #workingEntries = signal(new Map<string, ObjectTodoEntry[]>());

  readonly selectedTodoItems = computed(() => {
    const ids = new Set(this.selectedChecklistIds());
    return this.sortedTodoItems().filter((item) => ids.has(todoItemId(item)));
  });

  readonly hasChecklistSelection = computed(() => this.selectedChecklistIds().length > 0);

  readonly filteredChecklists = computed(() => {
    const query = this.checklistSearchQuery().trim().toLowerCase();
    const items = this.sortedTodoItems();
    if (!query) return items;
    return items.filter((item) => this.checklistLabel(item).toLowerCase().includes(query));
  });

  readonly sortedDisplayObjects = computed(() => {
    if (!this.hasChecklistSelection()) return [];

    const query = this.objectSearchQuery().trim().toLowerCase();
    const all = this.sortedObjects();
    const selectedIds = this.selectedChecklistIds();
    const assignedIds = new Set(
      objectsAssignedToAnyTodoItems(all, selectedIds)
        .map((object) => object._id?.$oid)
        .filter((id): id is string => !!id),
    );

    let filtered = all;
    if (query) {
      filtered = all.filter((object) => this.objectLabel(object).toLowerCase().includes(query));
    }

    const assigned = filtered.filter((object) => {
      const objectId = object._id?.$oid;
      return !!objectId && assignedIds.has(objectId);
    });
    const rest = filtered.filter((object) => {
      const objectId = object._id?.$oid;
      return !!objectId && !assignedIds.has(objectId);
    });
    return [...assigned, ...rest];
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

  checklistLabel(item: TodoItem): string {
    const title = item.title?.trim() ?? '';
    const note = item.note?.trim();
    return note ? `${title} (${note})` : title;
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

  isChecklistSelected(item: TodoItem): boolean {
    return this.selectedChecklistIds().includes(todoItemId(item));
  }

  toggleChecklist(item: TodoItem): void {
    const id = todoItemId(item);
    const current = this.selectedChecklistIds();
    if (current.includes(id)) {
      const next = current.filter((value) => value !== id);
      this.selectedChecklistIds.set(next);
      if (!next.length && this.mobileStep() === 'objects') {
        this.mobileStep.set('checklists');
      }
      return;
    }
    this.selectedChecklistIds.set([...current, id]);
  }

  selectAllChecklists(): void {
    this.selectedChecklistIds.set(this.sortedTodoItems().map((item) => todoItemId(item)));
  }

  clearChecklistSelection(): void {
    this.selectedChecklistIds.set([]);
    this.mobileStep.set('checklists');
  }

  goToChecklistsStep(): void {
    this.mobileStep.set('checklists');
  }

  goToObjectsStep(): void {
    if (!this.hasChecklistSelection()) return;
    this.mobileStep.set('objects');
  }

  entriesForObject(objectId: string): ObjectTodoEntry[] {
    return this.#workingEntries().get(objectId) ?? [];
  }

  isTodoAssigned(objectId: string, item: TodoItem): boolean {
    return isParentTodoAssigned(this.entriesForObject(objectId), todoItemId(item));
  }

  isObjectDirty(objectId: string): boolean {
    const snapshot = this.#initialSnapshots.get(objectId);
    if (!snapshot) return false;
    return serializeTodoEntries(this.entriesForObject(objectId)) !== snapshot;
  }

  objectRowClasses(object: ProjectObject): string[] {
    const objectId = object._id?.$oid;
    if (!objectId || !this.hasChecklistSelection()) return [];

    const selectedIds = new Set(this.selectedChecklistIds());
    const entries = this.entriesForObject(objectId).filter((entry) =>
      selectedIds.has(todoEntryItemId(entry)),
    );
    return objectTodoCardClassNames(entries, this.selectedTodoItems());
  }

  toggleObjectChecklist(object: ProjectObject, item: TodoItem, event: Event): void {
    const objectId = object._id?.$oid;
    if (!objectId) return;
    const checked = (event.target as HTMLInputElement).checked;
    this.#toggleAssignmentForObject(objectId, item, checked);
  }

  onObjectEntriesChange(object: ProjectObject, entries: ObjectTodoEntry[]): void {
    const objectId = object._id?.$oid;
    if (!objectId) return;
    this.#setEntries(objectId, entries);
  }

  assignAllSelectedChecklistsToAllObjects(): void {
    for (const object of this.sortedDisplayObjects()) {
      const objectId = object._id?.$oid;
      if (!objectId) continue;
      let entries = this.entriesForObject(objectId);
      for (const item of this.selectedTodoItems()) {
        if (!this.isTodoAssigned(objectId, item)) {
          entries = entriesForAssignedParent(item, entries);
        }
      }
      this.#setEntries(objectId, entries);
    }
  }

  clearSelectedChecklistsFromAllObjects(): void {
    for (const object of this.sortedDisplayObjects()) {
      const objectId = object._id?.$oid;
      if (!objectId) continue;
      let entries = this.entriesForObject(objectId);
      for (const item of this.selectedTodoItems()) {
        entries = entriesForUnassignedParent(todoItemId(item), entries);
      }
      this.#setEntries(objectId, entries);
    }
  }

  save(): void {
    const dirtyIds = [...this.#initialSnapshots.keys()].filter((id) => this.isObjectDirty(id));
    if (!dirtyIds.length) return;

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
        },
        error: (error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('todos.assignmentsSaveFailed'),
          );
        },
      });
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
    this.selectedChecklistIds.set([]);
    this.mobileStep.set('checklists');
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
