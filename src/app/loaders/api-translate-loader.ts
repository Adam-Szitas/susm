import { Injectable, inject } from '@angular/core';
import { TranslateLoader } from '@ngx-translate/core';
import { Observable, map, tap, catchError, of } from 'rxjs';
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
    
    return this.#httpService.get<TranslationResponse | TranslationResponse[] | Record<string, any>>(`translations/${language}`).pipe(
      map((response) => {
        // If response is an array, get the first item's translations
        if (Array.isArray(response) && response.length > 0) {
          const firstItem = response[0];
          if (firstItem && typeof firstItem === 'object' && 'translations' in firstItem) {
            return (firstItem as TranslationResponse).translations || {};
          }
          return {};
        }
        // If response is an object with translations property (TranslationResponse format)
        if (response && typeof response === 'object' && 'translations' in response) {
          return (response as TranslationResponse).translations || {};
        }
        // If response is directly a translations object (Record<string, string>)
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          // Check if it's already a flat translations object
          return response as Record<string, string>;
        }
        // Fallback to empty object
        return {};
      }),
      tap((translations) => {
        this.#translationStore.setTranslations(translations);
      }),
      catchError((error) => {
        console.error('Failed to load translations:', error);
        // Return empty translations object on error to prevent app crash
        return of({} as Record<string, string>);
      }),
    );
  }
}
