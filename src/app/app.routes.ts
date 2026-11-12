import { Routes } from '@angular/router';
import { authGuard, guestGuard, protocolsFeatureGuard } from './guards/user.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [guestGuard],
    loadComponent: () => import('./components/home/home.component').then((c) => c.HomeComponent),
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
    path: 'admin',
    loadChildren: () =>
      import('./components/admin/admin.routes').then((router) => router.AdminRoutes),
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
    canActivate: [authGuard, protocolsFeatureGuard],
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
        (c) => c.ObjectShareComponent,
      ),
  },
  {
    // Public checklist feedback (token is the access control; no auth guard so a
    // signed-in app-user opening the link still sees the visitor view).
    path: 'checklist-feedback/:token',
    data: { standalone: true },
    loadComponent: () =>
      import('./components/checklist-feedback/public/checklist-feedback-public.component').then(
        (c) => c.ChecklistFeedbackPublicComponent,
      ),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./components/home/not-found.component').then((c) => c.NotFoundComponent),
  },
];
