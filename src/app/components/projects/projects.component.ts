import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ProjectStore } from '../../store/project.store';
import { ModalService } from '../../services/modal.service';
import { ModalProjectComponent } from './new-project/project-modal.component';
import { TranslateModule } from '@ngx-translate/core';
import { Project } from '@models';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { PageHeaderComponent } from '../shared/page-header.component';
import { ProjectCardComponent } from '../shared/project-card.component';
import { FloatingAddButtonComponent } from '../shared/floating-add-button.component';
import {
  VirtualScrollViewportComponent,
  VIRTUAL_SCROLL_DEFAULT_THRESHOLD,
} from '../shared/virtual-scroll-viewport.component';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    PageHeaderComponent,
    ProjectCardComponent,
    FloatingAddButtonComponent,
    VirtualScrollViewportComponent,
    IconComponent,
  ],
})
export class ProjectsComponent implements OnInit {
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);

  protected readonly icons = icons;

  public showArchived = signal(false);
  readonly virtualScrollThreshold = VIRTUAL_SCROLL_DEFAULT_THRESHOLD;
  readonly projectCardItemSize = 196;

  public projects = computed(() => {
    const allProjects = this.#projectStore.projects();
    if (this.showArchived()) {
      return allProjects;
    }
    return allProjects.filter((project) => !project.archived_at);
  });

  trackProjectById = (_index: number, project: Project): string =>
    project._id?.$oid ?? project.name;

  public newProject(): void {
    this.#modalService.open({
      title: 'projects.newProject',
      component: ModalProjectComponent,
    });
  }

  public toggleArchived(): void {
    this.showArchived.update((value) => !value);
  }

  ngOnInit(): void {
    this.#projectStore.loadProjects();
  }
}
