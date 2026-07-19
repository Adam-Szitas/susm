import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';

/** SUSM wordmark / community icon for navbar and branding. */
@Component({
  selector: 'app-susm-logo',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'susm-logo',
    '[style.--susm-logo-size.px]': 'size()',
  },
  template: `<app-icon [icon]="icons.susmLogo" />`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      flex-shrink: 0;
      color: #fff;
      line-height: 0;
    }

    app-icon {
      display: block;
      --icon-size: var(--susm-logo-size, 2.25rem);
      --icon-block-size: var(--susm-logo-size, 2.25rem);
      --icon-inline-size: calc(var(--susm-logo-size, 2.25rem) * 512 / 305.98);
    }
  `,
})
export class SusmLogoComponent {
  protected readonly icons = icons;
  /** Logo height in px. */
  size = input(40);
}
