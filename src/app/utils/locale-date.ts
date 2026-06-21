import { parseMongoDateToMs } from '../models/mongo-date';

/** Display presets shared by `LocaleDatePipe` and `DateFormatService`. */
export type LocaleDatePreset = 'date' | 'datetime' | 'utcDate';

const LANGUAGE_TO_LOCALE: Record<string, string> = {
  en: 'en-GB',
  de: 'de-DE',
  sk: 'sk-SK',
};

/** Maps app language codes (`en`, `de`, `sk`) to BCP 47 locales for `Intl.DateTimeFormat`. */
export function appLanguageToLocale(language?: string | null): string {
  const code = language?.trim().toLowerCase() ?? 'en';
  return LANGUAGE_TO_LOCALE[code] ?? LANGUAGE_TO_LOCALE['en'];
}

export function coerceToDate(value: unknown): Date | null {
  const ms = parseMongoDateToMs(value);
  if (ms !== null) {
    return new Date(ms);
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function formatLocaleDate(
  value: unknown,
  locale: string,
  preset: LocaleDatePreset = 'date',
): string {
  const date = coerceToDate(value);
  if (!date) {
    return '';
  }

  const options: Intl.DateTimeFormatOptions =
    preset === 'datetime'
      ? {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }
      : {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        };

  if (preset === 'utcDate') {
    options.timeZone = 'UTC';
  }

  return new Intl.DateTimeFormat(locale, options).format(date);
}
