import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormGroup, Validators, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpService } from '../../services/http.service';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
})
export class RegisterComponent {
  #formBuilder = inject(FormBuilder);
  #httpService = inject(HttpService);
  #router = inject(Router);

  public form: FormGroup = this.#formBuilder.group({
    user: this.#formBuilder.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.email, Validators.required]],
      password: ['', [Validators.required, Validators.minLength(5)]],
      language: ['en', [Validators.required]],
      addresses: this.#formBuilder.group({
        street: ['', [Validators.required]],
        city: ['', [Validators.required]],
        country: ['', [Validators.required]],
      }),
    }),
    company: this.#formBuilder.group({
      name: ['', [Validators.required]],
      address: ['', [Validators.required]],
    }),
  });

  public Submit() {
    const credentials = this.form.getRawValue();
    const userAndCompany = JSON.stringify({
      user: credentials.user,
      company: {
        ...credentials.company,
        super_user: credentials.user,
      },
    });
    this.#httpService.post('register', userAndCompany).subscribe({
      next: this.handleSuccess,
      error: (error) => console.error(error),
    });
  }

  private handleSuccess(): void {
    this.#router.navigate(['/login']);
  }
}
