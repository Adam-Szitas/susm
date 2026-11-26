import { ChangeDetectionStrategy, Component, DestroyRef, inject, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AppInstallService } from '@services/app-install.service';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';

let nextInstallDialogId = 0;

@Component({
  selector: 'app-install-action',
  imports: [TranslateModule, IconComponent],
  templateUrl: './install-action.component.html',
  styleUrl: './install-action.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallActionComponent {
  readonly install = inject(AppInstallService);
  /** Projects-page banner. Navbar uses host classes `install-action--bar` and `install-action--menu`. */
  readonly invitation = input(false);
  protected readonly icons = icons;
  protected readonly titleId = `install-dialog-title-${++nextInstallDialogId}`;

  /** Press started outside the dialog box. Used only where `closedby` is missing (Safari). */
  #pressedOutside = false;
  #dialog: HTMLDialogElement | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.#dialog?.open) this.#dialog.close();
    });
  }

  /**
   * The navbar drawer is transformed, contained, and scrolling, and the bar sets
   * `color: white`. A dialog left in that tree inherits the bar color and can be
   * clipped. Move it to `document.body` before `showModal()` puts it in the top layer.
   */
  protected open(dialog: HTMLDialogElement): void {
    this.#dialog = dialog;
    if (dialog.parentElement !== document.body) document.body.appendChild(dialog);
    if (!dialog.open) dialog.showModal();
  }

  protected confirmInstall(dialog: HTMLDialogElement): void {
    dialog.close();
    void this.install.install();
  }

  protected armDismiss(event: PointerEvent, dialog: HTMLDialogElement): void {
    if ('closedBy' in HTMLDialogElement.prototype) return;
    this.#pressedOutside = this.#outside(event, dialog);
  }

  protected finishDismiss(event: PointerEvent, dialog: HTMLDialogElement): void {
    if ('closedBy' in HTMLDialogElement.prototype) return;
    if (this.#pressedOutside && this.#outside(event, dialog)) dialog.close();
    this.#pressedOutside = false;
  }

  #outside(event: PointerEvent, dialog: HTMLDialogElement): boolean {
    const rect = dialog.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  }
}
