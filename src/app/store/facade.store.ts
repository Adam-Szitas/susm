import { computed, inject, Injectable, signal, Signal } from "@angular/core";
import { UserStore } from "./user.store";
import { User } from "../models/user.model";


@Injectable({providedIn: 'root'})
export class FacadeStore {

  #userStore = inject(UserStore);

  constructor(){
    this.user = this.#userStore.user;
  }

  public user: Signal<User | null> = signal(null);
  public isLoggedIn: Signal<boolean | null> = computed(() => {
    return !!this.user();
  });

  public logout = computed(() => this.#userStore.logout)
}
