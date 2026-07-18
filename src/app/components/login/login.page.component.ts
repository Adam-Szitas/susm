import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LoginComponent } from './login.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-login />`,
  styles: `
    :host {
      display: block;
      min-block-size: calc(100dvh - var(--app-navbar-block, 3.5rem));
    }
  `,
  imports: [LoginComponent],
})
export class LoginPageComponent {}
