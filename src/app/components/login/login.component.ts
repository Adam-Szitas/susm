import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UserStore } from '../../store/user.store';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
})
export class LoginComponent {
  #userStore = inject(UserStore);
  #router = inject(Router);
  #route = inject(ActivatedRoute);

  constructor() {
    effect(() => {
      if (this.#userStore.isAuthenticated()) {
        // Get returnUrl from query params or default to projects
        const returnUrl = this.#route.snapshot.queryParams['returnUrl'] || '/projects';
        this.#router.navigateByUrl(returnUrl);
      }
    });
  }

  public form: FormGroup = new FormGroup({
    email: new FormControl('', Validators.required),
    password: new FormControl('', [Validators.required, Validators.minLength(5)]),
  });

  public Submit() {
    const credentials = this.form.getRawValue();
    const returnUrl = this.#route.snapshot.queryParams['returnUrl'] || '/projects';
    this.#userStore.login(credentials.email, credentials.password, returnUrl);
  }

  public getEmailControl(): FormControl {
    return this.form.get('email') as FormControl;
  }

  public getPasswordControl(): FormControl {
    return this.form.get('password') as FormControl;
  }
}
