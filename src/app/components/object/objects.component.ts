import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DEFAULT_WORK_STATUS, formatWorkStatus } from '@models';
import { ProjectStore } from '@store/project.store';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-object',
  templateUrl: './objects.component.html',
  styleUrl: './objects.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule],
})
export class ObjectComponent {
  #projectStore = inject(ProjectStore);
  public objectsWithProjects = this.#projectStore.objectsWithProjects;
  public readonly defaultStatus = DEFAULT_WORK_STATUS;
  public readonly formatStatus = formatWorkStatus;

  public ngOnInit(): void {
    this.#projectStore.loadAllObjects();
  }
}
