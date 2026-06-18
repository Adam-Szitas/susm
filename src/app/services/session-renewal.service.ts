import { Injectable } from '@angular/core';
import { msUntilTokenRenewal, shouldRenewTokenNow } from '../utils/jwt';

@Injectable({ providedIn: 'root' })
export class SessionRenewalService {
  #timerId: ReturnType<typeof setTimeout> | null = null;

  schedule(token: string, onRenew: () => void): void {
    this.clear();

    if (shouldRenewTokenNow(token)) {
      onRenew();
      return;
    }

    const delay = msUntilTokenRenewal(token);
    if (delay == null) {
      return;
    }

    this.#timerId = setTimeout(() => onRenew(), delay);
  }

  clear(): void {
    if (this.#timerId != null) {
      clearTimeout(this.#timerId);
      this.#timerId = null;
    }
  }
}
