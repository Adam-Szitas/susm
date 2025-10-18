import { computed, inject, signal } from '@angular/core';
import { Injectable } from '@angular/core';
import { User } from '../models/user.model';
import { HttpService } from '../services/http.service';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class UserStore {
  private _user = signal<User | null>((isBrowser() ? this.loadUser(): null));
  private _token = signal<string | null>((isBrowser() ? this.loadToken(): null));
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  readonly user = computed(() => this._user());
  readonly token = computed(() => this._token());
  readonly isAuthenticated = computed(() => !!this._token());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());

  #httpService = inject(HttpService);
  #router = inject(Router);

  private loadUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  private loadToken() {
    const token = localStorage.getItem('token');
    return token ? JSON.parse(token) : null;
  }

  login(email: string, password: string) {
    this._loading.set(true);
    this._error.set(null);

    this.#httpService.post<string>('login', {email, password}).subscribe({
      next: (token: string) => {
        this._token.set(token);
        localStorage.setItem('token', JSON.stringify(token));
        this.fetchUserProfile();
        this.redirectToProjects();
      },
      error: (err) => {
        this._error.set(err.error?.message || 'Login failed');
      },
      complete: () => {
        this._loading.set(false)
      },
    })
  }

  register(userInput: User) {
    this._loading.set(true);
    this._error.set(null);

    this.#httpService.post<User>('register', userInput).subscribe({
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
    this._user.set(null);
    this._token.set(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  private redirectToProjects(): void {
    this.#router.navigateByUrl('projects');
  }

  private fetchUserProfile() {
    this.#httpService.get<User>('profile').subscribe({
      next: (user) => {
        this._user.set(user);
        localStorage.setItem('user', JSON.stringify(user));
      },
      error: () => this.logout(),
      complete: () => console.log(this._user())
    });
  }
}

function isBrowser(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
