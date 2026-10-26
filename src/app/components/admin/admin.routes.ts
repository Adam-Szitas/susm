import { Routes } from '@angular/router';
import {
  platformAdminGuard,
  platformAdminLoginGuard,
} from '../../guards/user.guard';
import { AdminLoginPageComponent } from './admin-login-page.component';
import { PlatformAdminComponent } from './platform-admin.component';

export const AdminRoutes: Routes = [
  {
    path: 'login',
    canActivate: [platformAdminLoginGuard],
    component: AdminLoginPageComponent,
  },
  {
    path: '',
    canActivate: [platformAdminGuard],
    component: PlatformAdminComponent,
  },
];
