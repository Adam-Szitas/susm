import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { UserStore } from "../../store/user.store";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink]
})
export class LoginComponent {
  public form: FormGroup = new FormGroup({
      email: new FormControl('', Validators.required),
      password: new FormControl('', [Validators.required, Validators.minLength(5)])
    })

  #userStore = inject(UserStore);

  public Submit() {
    const credentials = this.form.getRawValue();
    this.#userStore.login(credentials.email, credentials.password);
  }

  public getEmailControl(): FormControl {
    return this.form.get('email') as FormControl;
  }

  public getPasswordControl(): FormControl {
    return this.form.get('password') as FormControl;
  }
}
