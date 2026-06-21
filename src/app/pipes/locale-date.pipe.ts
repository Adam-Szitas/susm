import { inject, Pipe, PipeTransform } from '@angular/core';
import { DateFormatService } from '../services/date-format.service';
import { LocaleDatePreset } from '../utils/locale-date';

/**
 * Locale-aware date formatting driven by the current user language.
 *
 * Usage:
 * - `{{ value | localeDate }}` — date
 * - `{{ value | localeDate:'datetime' }}` — date and time
 * - `{{ value | localeDate:'utcDate' }}` — UTC calendar day (picture dates)
 */
@Pipe({
  name: 'localeDate',
  standalone: true,
  pure: false,
})
export class LocaleDatePipe implements PipeTransform {
  #dateFormat = inject(DateFormatService);

  transform(value: unknown, preset: LocaleDatePreset = 'date'): string {
    if (value == null || value === '') {
      return '';
    }
    return this.#dateFormat.format(value, preset);
  }
}
