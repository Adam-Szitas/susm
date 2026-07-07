import { computed, Injectable, signal } from "@angular/core";


@Injectable({ providedIn: 'root' })
export class TranslationStore {
  private _translations = signal<Record<string, string>>({});
  readonly translations = computed(() => this._translations())

  setTranslations(newTranslations: Record<string, string>){
    this._translations.set(newTranslations);
  }

  clear(): void {
    this._translations.set({});
  }

  get(key: string): string {
    return this._translations()[key] || key;
  }

}

