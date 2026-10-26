import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { UserStore } from '../../store/user.store';
import { TranslateModule } from '@ngx-translate/core';
import { safeInternalReturnUrl } from '../../utils/platform';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateModule],
})
export class LoginComponent {
  #userStore = inject(UserStore);
  #route = inject(ActivatedRoute);

  readonly platformAdmin = input(false);

  readonly loading = this.#userStore.loading;
  readonly error = this.#userStore.error;

  public form: FormGroup = new FormGroup({
    email: new FormControl('', Validators.required),
    password: new FormControl('', [Validators.required, Validators.minLength(5)]),
  });

  public Submit() {
    if (this.form.invalid) {
      return;
    }
    const credentials = this.form.getRawValue();
    const returnUrl = safeInternalReturnUrl(
      this.#route.snapshot.queryParams['returnUrl'] ||
        (this.platformAdmin() ? '/admin' : '/projects'),
    );
    this.#userStore.login(
      credentials.email.trim().toLowerCase(),
      credentials.password,
      returnUrl,
    );
  }

  public getEmailControl(): FormControl {
    return this.form.get('email') as FormControl;
  }

  public getPasswordControl(): FormControl {
    return this.form.get('password') as FormControl;
  }
}
