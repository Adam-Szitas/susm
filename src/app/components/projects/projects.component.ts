import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ProjectStore } from "../../store/project.store";
import { ModalService } from "../../services/modal.service";
import { ModalProjectComponent } from "../../modals/project-modal.component";

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsComponent {
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);

  public readonly projects = this.#projectStore.projects;

  public newProject(): void {
    this.#modalService.open({
      title: 'New Project',
      component: ModalProjectComponent
    })
  }
}
