import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ProjectStore } from '../../store/project.store';
import { ModalService } from '../../services/modal.service';
import { ModalProjectComponent } from './new-project/project-modal.component';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DEFAULT_WORK_STATUS, formatWorkStatus } from '@models';
import { StatusPillComponent } from '../status-pill/app-status-pill.component';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule, StatusPillComponent],
})
export class ProjectsComponent implements OnInit {
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);

  public projects = this.#projectStore.projects;
  public readonly defaultStatus = DEFAULT_WORK_STATUS;
  public readonly formatStatus = formatWorkStatus;

  public newProject(): void {
    this.#modalService.open({
      title: 'projects.newProject',
      component: ModalProjectComponent,
    });
  }

  ngOnInit(): void {
    this.#projectStore.loadProjects();
  }
}
