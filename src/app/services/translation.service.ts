import { effect, inject, Injectable } from '@angular/core';
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

  constructor() {
    this.#translateService.setDefaultLang('en');
    effect(() => {
      const language = this.resolveLanguage(this.#userStore.user());
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

  private resolveLanguage(user: { language?: string | null } | null | undefined): SupportedLanguage {
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
