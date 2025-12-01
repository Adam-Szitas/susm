import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { HttpService } from '@services/http.service';
import { DEFAULT_WORK_STATUS, WorkStatus, formatWorkStatus, Address } from '@models';

interface PublicObjectResponse {
  id: string;
  address: Address;
  note: string;
  status: WorkStatus;
  project_name: string;
}

interface VerifyResponse {
  status: WorkStatus;
  verification_approved?: boolean;
  verification_note?: string;
  verification_decided_at?: string;
}

@Component({
  selector: 'app-object-share',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './object-share.component.html',
  styleUrl: './object-share.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectShareComponent implements OnInit {
  #route = inject(ActivatedRoute);
  #httpService = inject(HttpService);

  readonly formatStatus = formatWorkStatus;
  readonly defaultStatus = DEFAULT_WORK_STATUS;

  object = signal<PublicObjectResponse | null>(null);
  loading = signal(true);
  verifying = signal(false);
  loadError = signal<string | null>(null);
  actionError = signal<string | null>(null);
  success = signal(false);
  decisionNote = signal('');
  token!: string;

  ngOnInit(): void {
    this.token = this.#route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.loadError.set('share.errors.invalidLink');
      this.loading.set(false);
      return;
    }
    this.loadObject();
  }

  private loadObject(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.#httpService
      .get<PublicObjectResponse>(`public/object/${this.token}`)
      .subscribe({
        next: (response) => {
          this.object.set(response);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('share.errors.invalidLink');
          this.loading.set(false);
        },
      });
  }

  submitDecision(approve: boolean): void {
    if (this.verifying() || !this.object()) return;

    this.verifying.set(true);
    const payload = {
      approve,
      note: this.decisionNote().trim() || null,
    };

    this.#httpService
      .post<VerifyResponse>(`public/object/${this.token}/verify`, payload)
      .subscribe({
        next: (response) => {
          const updated = this.object();
          if (updated) {
            this.object.set({ ...updated, status: response.status });
          }
          this.verifying.set(false);
          this.success.set(true);
          this.actionError.set(null);
        },
        error: () => {
          this.verifying.set(false);
          this.actionError.set('share.errors.verifyFailed');
        },
      });
  }
}

