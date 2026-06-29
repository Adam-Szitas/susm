import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../environment';
import { ErrorHandlerService, AppError } from './error-handler.service';

@Injectable({
  providedIn: 'root',
})
export class HttpService {
  private readonly apiUrl: string;

  #http = inject(HttpClient);
  #errorHandler = inject(ErrorHandlerService);

  constructor() {
    this.apiUrl = environment.be;
  }

  get<T>(url: string, query?: Record<string, string | number | undefined | null>): Observable<T> {
    let params = new HttpParams();
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, String(value));
        }
      }
    }

    return this.#http
      .get<T>(`${this.apiUrl}/${url}`, {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        params,
      })
      .pipe(catchError((error) => this.handleError(error, url)));
  }

  post<T>(
    url: string,
    body: unknown,
    postHeaders?: HttpHeaders,
    options?: { suppressErrorNotification?: boolean },
  ): Observable<T> {
    const headers = postHeaders || new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.#http
      .post<T>(`${this.apiUrl}/${url}`, body, { headers })
      .pipe(
        catchError((error) =>
          this.handleError(error, url, options?.suppressErrorNotification),
        ),
      );
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

  private handleError(
    error: unknown,
    _url: string,
    suppressNotification = false,
  ): Observable<never> {
    const appError = this.#errorHandler.handleHttpError(error, {
      notify: !suppressNotification,
    });
    // Session expiry / auth invalid: logout is handled in AuthInterceptor (all HttpClient calls).
    return throwError(() => appError);
  }
}
