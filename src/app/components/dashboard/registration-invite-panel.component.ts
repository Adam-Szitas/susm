import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import QRCode from 'qrcode';
import { TranslateModule } from '@ngx-translate/core';
import { HttpService } from '../../services/http.service';
import { NotificationService } from '../../services/notification.service';
import { TranslationService } from '../../services/translation.service';
import { environment } from '../../environment';

@Component({
  selector: 'app-registration-invite-panel',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './registration-invite-panel.component.html',
  styleUrl: './registration-invite-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationInvitePanelComponent {
  #httpService = inject(HttpService);
  #router = inject(Router);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #platformId = inject(PLATFORM_ID);

  readonly shareUrl = signal<string | null>(null);
  readonly shareQrDataUrl = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  generateInvite(): void {
    if (this.loading()) {
      return;
    }

    this.error.set(null);
    this.loading.set(true);
    this.shareUrl.set(null);
    this.shareQrDataUrl.set(null);

    this.#httpService.post<{ token: string }>('company/registration-invite', {}).subscribe({
      next: ({ token }) => {
        const urlTree = this.#router.createUrlTree(['/register'], {
          queryParams: { invite: token },
        });
        const absoluteUrl = `${environment.frontend}${this.#router.serializeUrl(urlTree)}`;
        this.shareUrl.set(absoluteUrl);

        if (!isPlatformBrowser(this.#platformId)) {
          this.loading.set(false);
          return;
        }

        QRCode.toDataURL(absoluteUrl, { width: 256, margin: 2 })
          .then((dataUrl) => {
            this.shareQrDataUrl.set(dataUrl);
            this.loading.set(false);
          })
          .catch(() => {
            this.error.set(this.#translationService.instant('registrationInvite.qrError'));
            this.loading.set(false);
          });
      },
      error: () => {
        this.error.set(this.#translationService.instant('registrationInvite.createFailed'));
        this.loading.set(false);
      },
    });
  }

  copyLink(): void {
    const url = this.shareUrl();
    if (!url || !isPlatformBrowser(this.#platformId)) {
      return;
    }

    navigator.clipboard
      .writeText(url)
      .then(() => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('registrationInvite.copied'),
        );
      })
      .catch(() => {
        this.#notificationService.showError(
          this.#translationService.instant('registrationInvite.copyFailed'),
        );
      });
  }
}
