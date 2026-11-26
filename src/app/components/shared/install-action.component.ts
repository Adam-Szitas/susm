import { Component, inject, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AppInstallService } from '@services/app-install.service';

@Component({
  selector: 'app-install-action',
  imports: [TranslateModule],
  template: `
    @if (install.available() && (!invitation() || !install.dismissed())) {
      <div [class.invitation]="invitation()">
        @if (invitation()) {
          <span>{{ 'install.invitation' | translate }}</span>
        }
        <button type="button" (click)="install.install(help)">
          {{ 'install.add' | translate }}
        </button>
        @if (invitation()) {
          <button type="button" (click)="install.dismiss()">
            {{ 'install.dismiss' | translate }}
          </button>
        }
      </div>
    }
    <dialog #help [attr.aria-label]="'install.add' | translate">
      <p>{{ 'install.safari' | translate }}</p>
      <form method="dialog">
        <button>{{ 'common.close' | translate }}</button>
      </form>
    </dialog>
  `,
  styles: `
    .invitation {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: white;
      border-radius: 0.5rem;
    }
    .invitation span {
      margin-right: auto;
    }
    button {
      font: inherit;
      color: inherit;
      background: transparent;
      border: 0;
      padding: 0.65rem;
      margin: 0;
      cursor: pointer;
    }
    .invitation button,
    dialog button {
      color: var(--primary-default);
      font-weight: 600;
    }
    dialog {
      max-width: min(28rem, 85vw);
      border: 0;
      border-radius: 0.75rem;
      padding: 1.25rem;
    }
    dialog::backdrop {
      background: rgb(0 0 0 / 0.6);
    }
  `,
})
export class InstallActionComponent {
  readonly install = inject(AppInstallService);
  readonly invitation = input(false);
}
