import { Routes } from '@angular/router';

export const ProtocolsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./protocols.component').then((c) => c.ProtocolsComponent),
  },
];

