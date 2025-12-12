import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ProjectStore } from '../../store/project.store';
import { ModalService } from '../../services/modal.service';
import { ModalProjectComponent } from './new-project/project-modal.component';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DEFAULT_WORK_STATUS, formatWorkStatus } from '@models';
import { StatusPillComponent } from '../status-pill/app-status-pill.component';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule, StatusPillComponent, DatePipe],
})
export class ProjectsComponent implements OnInit {
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);

  public showArchived = signal(false);
  public readonly defaultStatus = DEFAULT_WORK_STATUS;
  public readonly formatStatus = formatWorkStatus;

  public projects = computed(() => {
    const allProjects = this.#projectStore.projects();
    if (this.showArchived()) {
      return allProjects;
    }
    return allProjects.filter(project => !project.archived_at);
  });

  public newProject(): void {
    this.#modalService.open({
      title: 'projects.newProject',
      component: ModalProjectComponent,
    });
  }

  public toggleArchived(): void {
    this.showArchived.update(value => !value);
  }

  ngOnInit(): void {
    this.#projectStore.loadProjects();
  }
}
