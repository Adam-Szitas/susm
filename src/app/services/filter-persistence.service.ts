import { Injectable } from '@angular/core';
import { FilterResult } from '@models';

export interface PersistedFilterState {
  filter: FilterResult;
  filtersVisible: boolean;
}

const KEY_PREFIX = 'filter_state_';

@Injectable({ providedIn: 'root' })
export class FilterPersistenceService {
  save(pageKey: string, state: PersistedFilterState): void {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(KEY_PREFIX + pageKey, JSON.stringify(state));
    } catch {
      /* quota or private-mode – silently ignore */
    }
  }

  restore(pageKey: string): PersistedFilterState | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(KEY_PREFIX + pageKey);
      return raw ? (JSON.parse(raw) as PersistedFilterState) : null;
    } catch {
      return null;
    }
  }

  clear(pageKey: string): void {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(KEY_PREFIX + pageKey);
    } catch {
      /* ignore */
    }
  }
}
