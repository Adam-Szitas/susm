import { ChangeDetectionStrategy, Component } from "@angular/core";
import { LoginComponent } from "./login.component";

@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div className="login-wrapper">
    <app-login />
  </div>`,
  imports: [LoginComponent]
})
export class LoginPageComponent {

}
