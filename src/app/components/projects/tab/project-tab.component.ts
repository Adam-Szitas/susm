import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectStore } from '../../../store/project.store';
import { Filter, FilterComponent } from '../../filter/filter.component';
import { ModalService } from '../../../services/modal.service';
import { ObjectModalComponent } from '../../object/new-object/object-modal.component';

@Component({
  selector: 'app-project-tab',
  templateUrl: './project-tab.component.html',
  styleUrl: './project-tab.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterComponent, RouterLink],
})
export class ProjectTabComponent implements OnInit {
  #route = inject(ActivatedRoute);
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);

  public project = this.#projectStore.project;
  public objects = this.#projectStore.objects;

  ngOnInit(): void {
    const projectId = this.#route.snapshot.paramMap.get('id');

    if (projectId) {
      this.#projectStore.loadProject(projectId);
    }
  }

  filterData(): Filter {
    return {
      placeholder: 'Search...',
      value: '',
      label: 'Search',
    };
  }

  filterChanged(event: any) {
    console.log(event);
    // this.#projectStore.getObjectsByTerm(event).subscribe();
  }

  addObject(): void {
    this.#modalService.open({
      title: 'New Project',
      component: ObjectModalComponent,
    });
  }
}
