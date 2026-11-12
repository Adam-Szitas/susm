import { DOCUMENT } from '@angular/common';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { effect, inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { UserStore } from '../store/user.store';

const SUPPORTED_LANGUAGES = ['en', 'de', 'sk'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  #translateService = inject(TranslateService);
  #userStore = inject(UserStore);
  /** Forces a language regardless of the signed-in user (public share pages). */
  readonly #override = signal<SupportedLanguage | null>(null);

  constructor() {
    const document = inject(DOCUMENT);
    this.#translateService.onLangChange
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((event) => (document.documentElement.lang = this.normalizeLanguage(event.lang)));
    this.#translateService.setDefaultLang('en');
    effect(() => {
      const language = this.#override() ?? this.resolveLanguage(this.#userStore.user());
      if (this.#translateService.currentLang !== language) {
        this.#translateService.use(language);
      }
    });
  }

  /**
   * Apply the current user language once at startup (also kept in sync via effect).
   */
  initialize(): void {
    const language = this.resolveLanguage(this.#userStore.user());
    this.#translateService.use(language);
  }

  /**
   * Pin the UI language (e.g. a public checklist-feedback page uses the share creator's
   * locale, never the visitor's browser). Pass `null` to return to the user's language.
   */
  setLanguageOverride(language: string | null): void {
    const next = language ? this.normalizeLanguage(language) : null;
    this.#override.set(next);
    this.#translateService.use(next ?? this.resolveLanguage(this.#userStore.user()));
  }

  /**
   * Change the current language
   */
  use(language: string): Observable<unknown> {
    const normalized = this.normalizeLanguage(language);
    return this.#translateService.use(normalized);
  }

  /**
   * Get current language
   */
  getCurrentLang(): string {
    return this.#translateService.currentLang || 'en';
  }

  /**
   * Get translation synchronously
   */
  instant(key: string | string[], params?: Record<string, unknown>): string {
    return this.#translateService.instant(key, params);
  }

  /**
   * Get translation as observable
   */
  get(key: string | string[], params?: Record<string, unknown>): Observable<string> {
    return this.#translateService.get(key, params);
  }

  private resolveLanguage(
    user: { language?: string | null } | null | undefined,
  ): SupportedLanguage {
    return this.normalizeLanguage(user?.language);
  }

  private normalizeLanguage(language?: string | null): SupportedLanguage {
    const preferred = language?.trim().toLowerCase();
    if (preferred && SUPPORTED_LANGUAGES.includes(preferred as SupportedLanguage)) {
      return preferred as SupportedLanguage;
    }
    return 'en';
  }
}
