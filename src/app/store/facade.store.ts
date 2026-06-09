import { computed, inject, Injectable } from '@angular/core';
import { UserStore } from './user.store';

@Injectable({ providedIn: 'root' })
export class FacadeStore {
  #userStore = inject(UserStore);

  readonly user = this.#userStore.user;
  readonly isLoggedIn = this.#userStore.isAuthenticated;
  readonly isAdmin = computed(() => this.#userStore.isAdmin());

  logout = () => this.#userStore.logout();
}
