import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormGroup, Validators, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpService } from '../../services/http.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';

interface PublicRegistrationInvite {
  valid: boolean;
  inviter_company_name: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
})
export class RegisterComponent implements OnInit {
  #formBuilder = inject(FormBuilder);
  #httpService = inject(HttpService);
  #router = inject(Router);
  #route = inject(ActivatedRoute);

  readonly inviteToken = signal<string | null>(null);
  readonly inviteLoading = signal(true);
  readonly inviteValid = signal(false);
  readonly inviterCompanyName = signal<string | null>(null);
  readonly inviteError = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

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

  ngOnInit(): void {
    const token = this.#route.snapshot.queryParamMap.get('invite')?.trim() ?? '';
    if (!token) {
      this.inviteLoading.set(false);
      this.inviteError.set('register.inviteRequired');
      this.form.disable();
      return;
    }

    this.inviteToken.set(token);
    this.#httpService
      .get<PublicRegistrationInvite>(`public/registration-invite/${encodeURIComponent(token)}`)
      .pipe(finalize(() => this.inviteLoading.set(false)))
      .subscribe({
        next: (invite) => {
          this.inviteValid.set(true);
          this.inviterCompanyName.set(invite.inviter_company_name);
        },
        error: () => {
          this.inviteError.set('register.inviteInvalid');
          this.form.disable();
        },
      });
  }

  public Submit() {
    const token = this.inviteToken();
    if (!token || this.form.invalid || this.submitting()) {
      return;
    }

    const credentials = this.form.getRawValue();
    this.submitting.set(true);
    this.submitError.set(null);

    const payload = {
      invite_token: token,
      user: credentials.user,
      company: credentials.company,
    };

    this.#httpService
      .post('register', payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.#router.navigate(['/login']),
        error: () => this.submitError.set('register.submitFailed'),
      });
  }
}
