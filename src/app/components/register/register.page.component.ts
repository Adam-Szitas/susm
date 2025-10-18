import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RegisterComponent } from "./register.component";

@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div className="login-wrapper">
    <app-register />
  </div>`,
  imports: [RegisterComponent]
})
export class LoginPageComponent {

}
