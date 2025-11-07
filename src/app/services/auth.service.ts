import { inject, Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  #httpService = inject(HttpService);

  login(email: string, password: string): Observable<any> {
    return this.#httpService.post<string>('login', { email, password });
  }

  register(userInput: User): Observable<any> {
    return this.#httpService.post<User>('register', userInput);
  }

  logout(): Observable<any> {
    return this.#httpService.post('logout', {});
  }
}
