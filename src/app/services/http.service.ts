import { inject, Injectable, Injector } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../environment';
import { UserStore } from '../store/user.store';
import { ErrorHandlerService, AppError } from './error-handler.service';

@Injectable({
  providedIn: 'root',
})
export class HttpService {
  private readonly apiUrl: string;

  #http = inject(HttpClient);
  #injector = inject(Injector);
  #errorHandler = inject(ErrorHandlerService);

  constructor() {
    this.apiUrl = environment.be;
  }

  get<T>(url: string): Observable<T> {
    return this.#http
      .get<T>(`${this.apiUrl}/${url}`, {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      })
      .pipe(catchError((error) => this.handleError(error, url)));
  }

  post<T>(url: string, body: unknown, postHeaders?: HttpHeaders): Observable<T> {
    const headers = postHeaders || new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.#http
      .post<T>(`${this.apiUrl}/${url}`, body, { headers })
      .pipe(catchError((error) => this.handleError(error, url)));
  }

  put<T>(url: string, body: unknown): Observable<T> {
    return this.#http
      .put<T>(`${this.apiUrl}/${url}`, body, {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      })
      .pipe(catchError((error) => this.handleError(error, url)));
  }

  delete<T>(url: string): Observable<T> {
    return this.#http
      .delete<T>(`${this.apiUrl}/${url}`)
      .pipe(catchError((error) => this.handleError(error, url)));
  }

  private handleError(error: unknown, url: string): Observable<never> {
    const appError = this.#errorHandler.handleHttpError(error);

    // Handle 401 errors by logging out (except for login/register endpoints)
    if (appError.status === 401 && !url.includes('login') && !url.includes('register')) {
      const userStore = this.#injector.get(UserStore);
      userStore.logout();
    }

    return throwError(() => appError);
  }
}
