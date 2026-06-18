import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateTeamUserPayload, TeamUser } from '../models/user.model';
import { HttpService } from './http.service';

@Injectable({ providedIn: 'root' })
export class TeamUsersService {
  #httpService = inject(HttpService);

  list(): Observable<TeamUser[]> {
    return this.#httpService.get<TeamUser[]>('users');
  }

  create(payload: CreateTeamUserPayload): Observable<TeamUser> {
    return this.#httpService.post<TeamUser>('users', payload);
  }

  delete(userId: string): Observable<void> {
    return this.#httpService.delete<void>(`users/${userId}`);
  }
}
