import { Injectable, inject } from '@angular/core';
import { TranslateLoader } from '@ngx-translate/core';
import { Observable, map, tap } from 'rxjs';
import { HttpService } from '../services/http.service';
import { TranslationStore } from '../store/translation.store';
import { UserStore } from '../store/user.store';

interface TranslationResponse {
  language: string;
  translations: Record<string, string>;
}

@Injectable()
export class ApiTranslateLoader implements TranslateLoader {
  #httpService = inject(HttpService);
  #userState = inject(UserStore);
  #translationStore = inject(TranslationStore);

  getTranslation(lang: string): Observable<Record<string, string>> {
    // Use provided lang or fallback to user's language or 'en'
    const language = lang || this.#userState.user()?.language?.toLowerCase() || 'en';
    
    return this.#httpService.get<TranslationResponse[]>(`translations/${language}`).pipe(
      map((response) => {
        // If response is an array, get the first item's translations
        if (Array.isArray(response) && response.length > 0) {
          return response[0].translations || {};
        }
        // If response is already an object with translations
        if (response && typeof response === 'object' && 'translations' in response) {
          return (response as unknown as TranslationResponse).translations;
        }
        // Fallback to empty object
        return {};
      }),
      tap((translations) => {
        this.#translationStore.setTranslations(translations);
      }),
    );
  }
}
