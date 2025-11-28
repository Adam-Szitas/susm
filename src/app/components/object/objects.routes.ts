import { Route } from '@angular/router';
import { ObjectComponent } from './objects.component';
import { ObjectTabComponent } from './tab/object-tab.component';

export const ObjectRoutes: Route[] = [
  {
    path: '',
    component: ObjectComponent,
  },
  {
    path: 'tab/:id',
    component: ObjectTabComponent,
  },
];
