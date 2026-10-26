import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { UserStore } from '../../store/user.store';
import { LoginComponent } from '../login/login.component';

@Component({
  selector: 'app-admin-login-page',
  standalone: true,
  imports: [LoginComponent, TranslateModule],
  template: `
    @if (isAuthenticated() && profileReady() && !isSuperuser()) {
      <p class="admin-login-notice" role="status">
        {{ 'admin.loginWrongAccount' | translate }}
      </p>
    }
    <app-login [platformAdmin]="true" />
  `,
  styles: `
    :host {
      display: block;
    }

    .admin-login-notice {
      position: relative;
      z-index: 1;
      inline-size: min(calc(100% - 2rem), 24rem);
      margin: 1rem auto -1rem;
      padding: 0.75rem 1rem;
      border: 1px solid #d7a54b;
      border-radius: 0.55rem;
      background: #fff8e8;
      color: #573b0a;
      font-size: 0.9rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLoginPageComponent {
  readonly isAuthenticated = inject(UserStore).isAuthenticated;
  readonly profileReady = inject(UserStore).profileReady;
  readonly isSuperuser = inject(UserStore).isSuperuser;
}
