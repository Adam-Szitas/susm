import { computed, signal } from "@angular/core";


export class TranslationStore {
  private _translations = signal<Record<string, string>>({});
  readonly translations = computed(() => this._translations())

  setTranslations(newTranslations: Record<string, string>){
    this._translations.set(newTranslations);
  }

  get(key: string): string {
    return this._translations()[key] || key;
  }

}

export const translationStore = new TranslationStore();
