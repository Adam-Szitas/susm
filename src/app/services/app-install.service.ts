import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class AppInstallService {
  private readonly pending = signal<InstallPrompt | null>(null);
  private readonly standalone = signal(false);
  private readonly safari = signal(false);
  readonly dismissed = signal(false);
  readonly available = computed(() => !this.standalone() && (this.safari() || !!this.pending()));

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const events = new AbortController();
    inject(DestroyRef).onDestroy(() => events.abort());
    const options = { signal: events.signal };
    const mode = window.matchMedia('(display-mode: standalone)');
    const nav = navigator as Navigator & { standalone?: boolean };
    this.standalone.set(mode.matches || !!nav.standalone);
    this.safari.set('standalone' in nav && /Version\/.*Safari\//.test(nav.userAgent));
    try {
      this.dismissed.set(localStorage.getItem('susm-install-dismissed') === '1');
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
    mode.addEventListener(
      'change',
      () => this.standalone.set(mode.matches || !!nav.standalone),
      options,
    );
    window.addEventListener(
      'beforeinstallprompt',
      (event) => {
        event.preventDefault();
        this.pending.set(event as InstallPrompt);
      },
      options,
    );
    window.addEventListener(
      'appinstalled',
      () => {
        this.pending.set(null);
        this.standalone.set(true);
      },
      options,
    );
  }

  dismiss(): void {
    this.dismissed.set(true);
    try {
      localStorage.setItem('susm-install-dismissed', '1');
    } catch {
      /* The invitation stays dismissed for this session. */
    }
  }

  async install(help: HTMLDialogElement): Promise<void> {
    const event = this.pending();
    if (event) {
      this.pending.set(null);
      try {
        await event.prompt();
      } catch {
        /* A browser can revoke the pending prompt. */
      }
    } else if (this.safari()) {
      help.showModal();
    }
  }
}
