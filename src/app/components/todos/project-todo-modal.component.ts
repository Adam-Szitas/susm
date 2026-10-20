import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, input } from '@angular/core';
import { Object as ProjectObject, TodoItem } from '@models';
import { ProjectStore } from '@store/project.store';
import { ProjectTodoAssignToChecklistsPanelComponent } from './project-todo-assign-to-checklists-panel.component';

/** Project checklist modal. Assign checklists here; add and edit them in a modal stacked on top. */
@Component({
  selector: 'app-project-todo-modal',
  standalone: true,
  imports: [ProjectTodoAssignToChecklistsPanelComponent],
  templateUrl: './project-todo-modal.component.html',
  styleUrl: './project-todo-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTodoModalComponent {
  #projectStore = inject(ProjectStore);
  #cdr = inject(ChangeDetectorRef);

  projectId = input.required<string>();
  todoItems = input<TodoItem[]>([]);
  objects = input<ProjectObject[]>([]);

  savedTodoItems(): TodoItem[] {
    return this.#projectStore.project()?.todo_items ?? this.todoItems() ?? [];
  }

  onAssignmentsSaved(): void {
    this.#cdr.markForCheck();
  }
}
