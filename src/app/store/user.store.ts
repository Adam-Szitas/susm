import { computed, inject, signal } from '@angular/core';
import { Injectable } from '@angular/core';
import { User } from '../models/user.model';
import { HttpService } from '../services/http.service';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

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
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());
  readonly initialized = computed(() => this._initialized());

  #httpService = inject(HttpService);
  #router = inject(Router);
  #authService = inject(AuthService);

  constructor() {
    // Don't load in constructor - let APP_INITIALIZER handle it
    // This prevents blocking and allows proper SSR handling
  }

  /**
   * Initialize the store by loading data from localStorage
   * Should be called via APP_INITIALIZER before app starts
   */
  initialize(): Promise<void> {
    if (!isBrowser()) {
      this._initialized.set(true);
      return Promise.resolve();
    }

    try {
      // Load token first (faster, just a string)
      const token = this.loadToken();
      if (token) {
        this._token.set(token);
      }

      // Load user data
      const user = this.loadUser();
      if (user) {
        this._user.set(user);
      }

      // If we have a token but no user, fetch the profile
      if (token && !user) {
        this.fetchUserProfile();
      }
    } catch (error) {
      console.error('Error initializing user store:', error);
      // Clear potentially corrupted data
      this.clearStorage();
    } finally {
      this._initialized.set(true);
    }

    return Promise.resolve();
  }

  private loadUser(): User | null {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return null;
      return JSON.parse(userStr) as User;
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      return null;
    }
  }

  private loadToken(): string | null {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      // Token is stored as a string, but might be JSON.stringified
      // Try to parse it, if it fails, use it as-is
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

  private clearStorage(): void {
    if (isBrowser()) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }

  login(email: string, password: string, returnUrl: string = '/projects') {
    this._loading.set(true);
    this._error.set(null);

    this.#authService.login(email, password).subscribe({
      next: (token: string) => {
        this._token.set(token);
        // Store token as string (not JSON.stringified) for faster access
        if (isBrowser()) {
          localStorage.setItem('token', token);
        }
        this.fetchUserProfile();
        // Navigate to the return URL instead of always going to projects
        this.#router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this._error.set(err.error?.message || 'Login failed');
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

  logout() {
    try {
      this._user.set(null);
      this._token.set(null);
      if (isBrowser()) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } catch (error) {
      console.error(error);
    }
    this.#router.navigateByUrl('login');
  }

  private fetchUserProfile() {
    this.#httpService.get<User>('profile').subscribe({
      next: (user) => {
        this._user.set(user);
        if (isBrowser()) {
          localStorage.setItem('user', JSON.stringify(user));
        }
      },
      error: () => this.logout(),
    });
  }
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}
