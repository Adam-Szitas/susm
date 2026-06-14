import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Object as ProjectObject, TodoItem } from '@models';
import { ModalService } from '@services/modal.service';
import { ProjectTodoAssignmentPanelComponent } from './project-todo-assignment-panel.component';
import { ProjectTodoAssignmentVerifyPanelComponent } from './project-todo-assignment-verify-panel.component';

@Component({
  selector: 'app-project-todo-assignment-modal',
  standalone: true,
  imports: [CommonModule, ProjectTodoAssignmentPanelComponent, ProjectTodoAssignmentVerifyPanelComponent],
  styleUrl: './project-todo-assignment-modal.component.scss',
  template: `
    @if (mode() === 'verify') {
      <app-project-todo-assignment-verify-panel
        [todoItems]="todoItems()"
        [objects]="objects()"
        (backRequested)="mode.set('assign')"
      />
    } @else {
      <app-project-todo-assignment-panel
        [todoItems]="todoItems()"
        [objects]="objects()"
        (cancelRequested)="close()"
        (verifyRequested)="mode.set('verify')"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTodoAssignmentModalComponent {
  #modalService = inject(ModalService);

  projectId = input.required<string>();
  todoItems = input<TodoItem[]>([]);
  objects = input<ProjectObject[]>([]);

  mode = signal<'assign' | 'verify'>('assign');

  close(): void {
    this.#modalService.close();
  }
}
