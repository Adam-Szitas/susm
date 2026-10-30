import { trashFeatureGuard } from '../../guards/user.guard';
import { Route } from '@angular/router';
import { FilesComponent } from './files.component';
import { RemovedFilesComponent } from './removed-files.component';

export const FilesRoutes: Route[] = [
  {
    path: '',
    component: FilesComponent,
  },
  {
    path: 'removed',
    canActivate: [trashFeatureGuard],
    component: RemovedFilesComponent,
  },
];
