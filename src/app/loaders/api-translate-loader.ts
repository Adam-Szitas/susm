import { Injectable, inject } from "@angular/core";
import { TranslateLoader } from "@ngx-translate/core";
import { Observable, tap } from "rxjs";
import { HttpService } from "../services/http.service";
import { TranslationStore } from "../store/translation.store";
import { UserStore } from "../store/user.store";

@Injectable()
export class ApiTranslateLoader implements TranslateLoader {
  #httpService = inject(HttpService);
  #userState = inject(UserStore);
  #translationStore = inject(TranslationStore);

  getTranslation(lang: string): Observable<Record<string, string>> {
    const language = this.#userState.user()?.language ?? 'en';
    return this.#httpService
      .get<Record<string, string>>(`translations/${language}`)
      .pipe(tap(translations => {
        console.log(translations);
        return this.#translationStore.setTranslations(translations)
      }));
  }
}
