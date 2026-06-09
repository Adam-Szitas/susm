import { computed, inject, PLATFORM_ID, signal } from '@angular/core';
import { Injectable } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { User } from '../models/user.model';
import { HttpService } from '../services/http.service';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UrlPersistenceService } from '../services/url-persistence.service';
import { ProjectStore } from './project.store';
import { TranslationStore } from './translation.store';
import { safeInternalReturnUrl } from '../utils/platform';
import { catchError, finalize, map, of, switchMap, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserStore {
  private _user = signal<User | null>(null);
  private _token = signal<string | null>(null);
  private _loading = signal(false);
  private _error = signal<string | null>(null);
  private _initialized = signal(false);

  readonly user = computed(() => this._user());
  readonly token = computed(() => this._token());
  readonly isAuthenticated = computed(() => !!this._token());
  readonly isAdmin = computed(() => this._user()?.role === 'admin');
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());
  readonly initialized = computed(() => this._initialized());

  #httpService = inject(HttpService);
  #router = inject(Router);
  #authService = inject(AuthService);
  #urlPersistenceService = inject(UrlPersistenceService);
  #projectStore = inject(ProjectStore);
  #translationStore = inject(TranslationStore);
  #platformId = inject(PLATFORM_ID);
  #invalidatingSession = false;

  initialize(): Promise<void> {
    if (!isPlatformBrowser(this.#platformId)) {
      this._initialized.set(true);
      return Promise.resolve();
    }

    const finish = () => this._initialized.set(true);

    try {
      const token = this.#readTokenFromStorage();
      if (!token) {
        finish();
        return Promise.resolve();
      }

      this._token.set(token);
      const cachedUser = this.#readUserFromStorage();
      if (cachedUser) {
        this._user.set(cachedUser);
        finish();
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        this.#httpService
          .get<User>('profile')
          .pipe(
            tap((profile) => this.#persistUser(profile)),
            catchError(() => {
              this.#clearSessionState();
              return of(null);
            }),
            finalize(() => {
              finish();
              resolve();
            }),
          )
          .subscribe();
      });
    } catch (error) {
      console.error('Error initializing user store:', error);
      this.#clearSessionState();
      this.#projectStore.reset();
      this.#translationStore.clear();
      finish();
      return Promise.resolve();
    }
  }

  login(email: string, password: string, returnUrl = '/projects') {
    this._loading.set(true);
    this._error.set(null);

    this.#authService
      .login(email, password)
      .pipe(
        map((token) => this.#normalizeToken(token)),
        switchMap((token) => {
          this._token.set(token);
          this.#writeTokenToStorage(token);
          return this.#httpService.get<User>('profile').pipe(
            tap((user) => this.#persistUser(user)),
            map((user) => ({ token, user })),
          );
        }),
      )
      .subscribe({
        next: () => {
          void this.#router.navigateByUrl(safeInternalReturnUrl(returnUrl));
        },
        error: (err) => {
          this.#clearSessionState();
          this._error.set(err?.message || err?.error?.message || 'Login failed');
        },
        complete: () => {
          this._loading.set(false);
        },
      });
  }

  register(userInput: User) {
    this._loading.set(true);
    this._error.set(null);

    this.#authService.register(userInput).subscribe({
      next: (user) => {
        this._user.set(user);
      },
      error: (err) => {
        this._error.set(err.error?.message || 'Registration failed');
      },
      complete: () => this._loading.set(false),
    });
  }

  logout(): void {
    if (this.#invalidatingSession) {
      return;
    }
    this.#invalidatingSession = true;

    try {
      this.#clearSessionState();
      this.#projectStore.reset();
      this.#translationStore.clear();
      this.#urlPersistenceService.clearStoredUrl();
    } catch (error) {
      console.error(error);
    }

    const onLogin = this.#router.url.startsWith('/login');
    if (!onLogin) {
      void this.#router.navigate(['/login'], {
        queryParams: { returnUrl: this.#router.url },
        replaceUrl: true,
      });
    }

    queueMicrotask(() => {
      this.#invalidatingSession = false;
    });
  }

  updateLanguage(language: string): void {
    this.#httpService.put<User>('profile', { language }).subscribe({
      next: (user) => {
        this.#persistUser(user);
      },
      error: (error) => {
        console.error('Failed to update language:', error);
      },
    });
  }

  #normalizeToken(token: unknown): string {
    if (typeof token === 'string') {
      return token;
    }
    if (token != null) {
      return String(token);
    }
    throw new Error('Login failed: missing token');
  }

  #persistUser(user: User): void {
    this._user.set(user);
    if (isPlatformBrowser(this.#platformId)) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }

  #writeTokenToStorage(token: string): void {
    if (isPlatformBrowser(this.#platformId)) {
      localStorage.setItem('token', token);
    }
  }

  #readUserFromStorage(): User | null {
    if (!isPlatformBrowser(this.#platformId)) {
      return null;
    }
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return null;
      return JSON.parse(userStr) as User;
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      return null;
    }
  }

  #readTokenFromStorage(): string | null {
    if (!isPlatformBrowser(this.#platformId)) {
      return null;
    }
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      try {
        const parsed = JSON.parse(token);
        return typeof parsed === 'string' ? parsed : token;
      } catch {
        return token;
      }
    } catch (error) {
      console.error('Error loading token from localStorage:', error);
      return null;
    }
  }

  #clearSessionState(): void {
    this._user.set(null);
    this._token.set(null);
    this._error.set(null);
    if (isPlatformBrowser(this.#platformId)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
}
