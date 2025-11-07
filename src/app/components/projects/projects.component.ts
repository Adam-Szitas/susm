import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ProjectStore } from '../../store/project.store';
import { ModalService } from '../../services/modal.service';
import { ModalProjectComponent } from './new-project/project-modal.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class ProjectsComponent implements OnInit {
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);

  public projects = this.#projectStore.projects;

  public newProject(): void {
    this.#modalService.open({
      title: 'New Project',
      component: ModalProjectComponent,
    });
  }

  ngOnInit(): void {
    this.#projectStore.loadProjects();
  }
}
