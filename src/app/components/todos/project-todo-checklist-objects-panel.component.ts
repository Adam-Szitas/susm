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
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import {
  ObjectTodoEntry,
  Object as ProjectObject,
  objectsAssignedToTodoItem,
  sortObjectsByStoredOrder,
  TodoItem,
  todoItemId,
} from '@models';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { TodoItemValueControlComponent } from './todo-item-value-control.component';

@Component({
  selector: 'app-project-todo-checklist-objects-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TodoItemValueControlComponent],
  templateUrl: './project-todo-checklist-objects-panel.component.html',
  styleUrl: './project-todo-checklist-objects-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTodoChecklistObjectsPanelComponent {
  #projectStore = inject(ProjectStore);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);

  todoItem = input.required<TodoItem>();
  objects = input<ProjectObject[]>([]);

  backRequested = output<void>();

  searchQuery = signal('');
  savingObjectId = signal<string | null>(null);

  readonly assignedObjects = computed(() =>
    sortObjectsByStoredOrder(
      objectsAssignedToTodoItem(this.objects(), todoItemId(this.todoItem())),
    ),
  );

  readonly filteredObjects = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const items = this.assignedObjects();
    if (!query) return items;
    return items.filter((object) => this.objectLabel(object).toLowerCase().includes(query));
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

  isSaving(object: ProjectObject): boolean {
    const objectId = object._id?.$oid;
    return !!objectId && this.savingObjectId() === objectId;
  }

  onEntriesChange(object: ProjectObject, entries: ObjectTodoEntry[]): void {
    const objectId = object._id?.$oid;
    if (!objectId || this.savingObjectId()) {
      return;
    }

    this.savingObjectId.set(objectId);
    this.#projectStore
      .updateObjectTodos(objectId, entries)
      .pipe(finalize(() => this.savingObjectId.set(null)))
      .subscribe({
        error: (error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('todos.objectUpdateFailed'),
          );
        },
      });
  }

  back(): void {
    this.backRequested.emit();
  }
}
