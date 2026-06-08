import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserStore } from '../../store/user.store';
import { TranslateModule } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';
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
  #router = inject(Router);
  #route = inject(ActivatedRoute);
  #translationService = inject(TranslationService);

  constructor() {
    effect(() => {
      if (this.#userStore.isAuthenticated()) {
        const returnUrl = safeInternalReturnUrl(this.#route.snapshot.queryParams['returnUrl']);
        this.#router.navigateByUrl(returnUrl);
      }
      if (this.#userStore.user()) {
        const language = this.#userStore.user()?.language;
        if (language) {
          this.#translationService.initialize();
        }
      }
    });
  }

  public form: FormGroup = new FormGroup({
    email: new FormControl('', Validators.required),
    password: new FormControl('', [Validators.required, Validators.minLength(5)]),
  });

  public Submit() {
    if (this.form.invalid) {
      return;
    }
    const credentials = this.form.getRawValue();
    const returnUrl = safeInternalReturnUrl(this.#route.snapshot.queryParams['returnUrl']);
    this.#userStore.login(credentials.email, credentials.password, returnUrl);
  }

  public getEmailControl(): FormControl {
    return this.form.get('email') as FormControl;
  }

  public getPasswordControl(): FormControl {
    return this.form.get('password') as FormControl;
  }
}
