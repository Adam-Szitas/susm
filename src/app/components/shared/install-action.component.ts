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
        <button type="button" aria-haspopup="dialog" (click)="help.showModal()">
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
      <h2>{{ 'install.add' | translate }}</h2>
      <p>{{ 'install.launch' | translate }}</p>
      <p>{{ 'install.offline' | translate }}</p>
      @if (!install.canPrompt()) {
        <p>{{ 'install.safari' | translate }}</p>
      }
      <form method="dialog">
        <button>{{ 'common.close' | translate }}</button>
        @if (install.canPrompt()) {
          <button type="button" class="button button-primary" (click)="help.close(); install.install()">
            {{ 'install.continue' | translate }}
          </button>
        }
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
    dialog {
      color: var(--text-primary, #252525);
      font-weight: normal;
      line-height: 1.5;
      max-height: calc(100dvh - var(--safe-top) - var(--safe-bottom) - 2rem);
      overflow: auto;
    }
    dialog h2 { font-size: 1.25rem; margin: 0; }
    dialog form { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .5rem; }
    dialog .button-primary { background: var(--primary-default); color: white; }
    dialog::backdrop {
      background: rgb(0 0 0 / 0.6);
    }
  `,
})
export class InstallActionComponent {
  readonly install = inject(AppInstallService);
  readonly invitation = input(false);
}
