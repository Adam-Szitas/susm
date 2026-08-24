import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { Object, formatObjectDisplayLabel } from '@models';
import { StatusPillComponent } from '../status-pill/app-status-pill.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';

@Component({
  selector: 'app-object-card',
  standalone: true,
  imports: [RouterLink, NgClass, StatusPillComponent, LocaleDatePipe],
  templateUrl: './object-card.component.html',
  styleUrl: './object-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.object-card-host--list]': 'layout() === "list"',
  },
})
export class ObjectCardComponent {
  readonly object = input.required<Object>();
  readonly projectName = input<string | null>(null);
  /** `list` = full-width project object rows; `catalog` = centered grid cards. */
  readonly layout = input<'catalog' | 'list'>('catalog');
  readonly compact = input(false);
  readonly showStatus = input(false);
  readonly routerLink = input<string | string[] | null>(null);
  readonly queryParams = input<Params | null>(null);
  readonly cardClasses = input<string | string[] | Record<string, boolean> | null>(null);
  readonly showMeta = input(true);
  readonly includePostalCode = input(false);
  readonly dateFormat = input<'date' | 'datetime'>('date');
  readonly fallbackLabel = input('');

  readonly displayLabel = computed(() =>
    formatObjectDisplayLabel(this.object(), {
      compact: this.compact(),
      includePostalCode: this.includePostalCode(),
      fallback: this.fallbackLabel(),
    }),
  );
}
