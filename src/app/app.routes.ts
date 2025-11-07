import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadChildren: () =>
      import('./components/login/login.routes').then((router) => router.LoginRoutes),
  },
  {
    path: 'register',
    loadChildren: () =>
      import('./components/register/register.routes').then((router) => router.RegisterRoutes),
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./components/dashboard/dashboard.routes').then((router) => router.DashboardRoutes),
  },
  {
    path: 'projects',
    loadChildren: () =>
      import('./components/projects/projects.routes').then((router) => router.ProjectsRoutes),
  },
  {
    path: 'objects',
    loadChildren: () =>
      import('./components/object/object.routes').then((router) => router.ObjectRoutes),
  },
];
