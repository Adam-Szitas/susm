import { inject, Injectable } from '@angular/core';
import {
  appLanguageToLocale,
  formatLocaleDate,
  LocaleDatePreset,
} from '../utils/locale-date';
import { TranslationService } from './translation.service';

@Injectable({ providedIn: 'root' })
export class DateFormatService {
  #translationService = inject(TranslationService);

  format(value: unknown, preset: LocaleDatePreset = 'date'): string {
    const locale = appLanguageToLocale(this.#translationService.getCurrentLang());
    return formatLocaleDate(value, locale, preset);
  }

  formatDate(value: unknown): string {
    return this.format(value, 'date');
  }

  formatDateTime(value: unknown): string {
    return this.format(value, 'datetime');
  }

  /** UTC calendar day — used for picture metadata (matches protocol PDF). */
  formatUtcDate(value: unknown): string {
    return this.format(value, 'utcDate');
  }
}
