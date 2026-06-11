import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Object as ProjectObject, TodoItem } from '@models';
import { ModalService } from '@services/modal.service';
import { ProjectTodoAssignmentPanelComponent } from './project-todo-assignment-panel.component';

@Component({
  selector: 'app-project-todo-assignment-modal',
  standalone: true,
  imports: [CommonModule, ProjectTodoAssignmentPanelComponent],
  styleUrl: './project-todo-assignment-modal.component.scss',
  template: `
    <app-project-todo-assignment-panel
      [todoItems]="todoItems()"
      [objects]="objects()"
      (cancelRequested)="close()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTodoAssignmentModalComponent {
  #modalService = inject(ModalService);

  projectId = input.required<string>();
  todoItems = input<TodoItem[]>([]);
  objects = input<ProjectObject[]>([]);

  close(): void {
    this.#modalService.close();
  }
}
