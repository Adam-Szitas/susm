import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../environment';
import { UserStore } from '../store/user.store';

type TrackedRoute =
  | 'dashboard'
  | 'projects'
  | 'project_detail'
  | 'objects'
  | 'object_detail'
  | 'protocols'
  | 'files'
  | 'trash';

interface QueuedEvent {
  name: 'page_view';
  route: TrackedRoute;
}

const BATCH_SIZE = 20;
const MAX_QUEUE_SIZE = 200;
const FLUSH_INTERVAL_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class TrackingQueueService {
  #router = inject(Router);
  #userStore = inject(UserStore);
  #platformId = inject(PLATFORM_ID);
  #queue: QueuedEvent[] = [];
  #queueToken: string | null = null;
  #flushTimer: number | null = null;
  #started = false;
  #retryCount = 0;

  start(): void {
    if (this.#started || !isPlatformBrowser(this.#platformId)) return;
    this.#started = true;

    this.#router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.#trackPage(event.urlAfterRedirects));

    window.setInterval(() => this.#scheduleFlush(0), FLUSH_INTERVAL_MS);
    window.addEventListener('online', () => this.#scheduleFlush(0));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.#scheduleFlush(0);
    });
  }

  #trackPage(url: string): void {
    const token = this.#userStore.token();
    if (!token) {
      this.#queue = [];
      this.#queueToken = null;
      return;
    }

    const route = this.#safeRoute(url);
    if (!route) return;
    if (this.#queueToken !== token) {
      this.#queue = [];
      this.#queueToken = token;
    }
    if (this.#queue.length >= MAX_QUEUE_SIZE) this.#queue.shift();
    this.#queue.push({ name: 'page_view', route });
    this.#scheduleFlush(this.#queue.length >= BATCH_SIZE ? 0 : FLUSH_INTERVAL_MS);
  }

  #safeRoute(url: string): TrackedRoute | null {
    const path = url.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
    if (path === '/dashboard') return 'dashboard';
    if (path === '/projects') return 'projects';
    if (path.startsWith('/projects/tab/')) return 'project_detail';
    if (path === '/objects') return 'objects';
    if (path.startsWith('/objects/tab/')) return 'object_detail';
    if (path === '/protocols') return 'protocols';
    if (path === '/files') return 'files';
    if (path === '/files/removed') return 'trash';
    return null;
  }

  #scheduleFlush(delay: number): void {
    if (this.#flushTimer !== null || this.#queue.length === 0) return;
    this.#flushTimer = window.setTimeout(() => {
      this.#flushTimer = null;
      const idleWindow = window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      };
      if (idleWindow.requestIdleCallback) {
        idleWindow.requestIdleCallback(() => void this.#flush(), { timeout: 2_000 });
      } else {
        window.setTimeout(() => void this.#flush(), 0);
      }
    }, delay);
  }

  async #flush(): Promise<void> {
    const token = this.#userStore.token();
    if (!token || !this.#queue.length || !navigator.onLine) return;
    if (token !== this.#queueToken) {
      this.#queue = [];
      this.#queueToken = null;
      return;
    }

    const batch = this.#queue.splice(0, BATCH_SIZE);
    try {
      const response = await fetch(`${environment.be}/tracking/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
        ...({ priority: 'low' } as RequestInit & { priority: 'low' }),
      });
      if (!response.ok) throw new Error('Tracking batch was not accepted');
      this.#retryCount = 0;
      if (this.#queue.length) this.#scheduleFlush(1_000);
    } catch {
      if (this.#userStore.token() === token) {
        this.#queue = [...batch, ...this.#queue].slice(-MAX_QUEUE_SIZE);
        this.#queueToken = token;
        this.#retryCount += 1;
        if (this.#retryCount > 5) {
          this.#queue.splice(0, batch.length);
          this.#retryCount = 0;
          this.#scheduleFlush(FLUSH_INTERVAL_MS);
        } else {
          this.#scheduleFlush(Math.min(60_000, 1_000 * 2 ** this.#retryCount));
        }
      }
    }
  }
}
