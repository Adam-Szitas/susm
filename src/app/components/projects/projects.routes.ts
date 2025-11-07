import { Route } from '@angular/router';
import { ProjectsComponent } from './projects.component';
import { ProjectTabComponent } from './tab/project-tab.component';

export const ProjectsRoutes: Route[] = [
  {
    path: '',
    component: ProjectsComponent,
  },
  {
    path: 'tab/:id',
    component: ProjectTabComponent,
  },
];
