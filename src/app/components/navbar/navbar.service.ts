import { Injectable, signal } from "@angular/core";

@Injectable({providedIn: 'root'})
export class NavbarService {
  private permission = signal<UserPermission>('technic');
  private user = signal<User | null>(null);


}


export type UserPermission = 'admin' | 'operator' | 'technic';
export interface User {
  id: number;
  name: string;
  email: string;
}
