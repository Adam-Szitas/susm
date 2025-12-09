import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { UserStore } from '../store/user.store';

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  #translateService = inject(TranslateService);
  #userStore = inject(UserStore);

  /**
   * Initialize translations based on user's language preference
   */
  initialize(): void {
    const userLanguage = this.#userStore.user()?.language?.toLowerCase() || 'de';
    this.#translateService.setDefaultLang('de');
    this.#translateService.use(userLanguage);
  }

  /**
   * Change the current language
   */
  use(language: string): Observable<any> {
    return this.#translateService.use(language);
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
  instant(key: string | string[], params?: Record<string, any>): string {
    return this.#translateService.instant(key, params);
  }

  /**
   * Get translation as observable
   */
  get(key: string | string[], params?: Record<string, any>): Observable<string> {
    return this.#translateService.get(key, params);
  }
}
