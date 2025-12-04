import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/user.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'projects',
    pathMatch: 'full',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./components/login/login.routes').then((router) => router.LoginRoutes),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./components/register/register.routes').then((router) => router.RegisterRoutes),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./components/dashboard/dashboard.routes').then((router) => router.DashboardRoutes),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./components/projects/projects.routes').then((router) => router.ProjectsRoutes),
  },
  {
    path: 'objects',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./components/object/objects.routes').then((router) => router.ObjectRoutes),
  },
  {
    path: 'protocols',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./components/protocols/protocols.routes').then((router) => router.ProtocolsRoutes),
  },
  {
    path: 'files',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./components/files/files.routes').then((router) => router.FilesRoutes),
  },
  {
    path: 'share/:token',
    loadComponent: () =>
      import('./components/object/share/object-share.component').then(
        (c) => c.ObjectShareComponent
      ),
  },
];
