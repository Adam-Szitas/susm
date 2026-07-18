import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RegisterComponent } from "./register.component";

@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-register />`,
  imports: [RegisterComponent]
})
export class LoginPageComponent {

}
