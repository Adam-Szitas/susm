import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../environment';

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private readonly apiUrl: string = 'http://localhost:8080';

  #http = inject(HttpClient);
  constructor() {
    this.apiUrl = environment.be;
  }

  get<T>(url: string): Observable<T> {
    return this.#http.get<T>(`${this.apiUrl}/${url}`).pipe(
      catchError(this.errorHandler)
    );
  }

  post<T>(url: string, body: any): Observable<T> {
    return this.#http.post<T>(`${this.apiUrl}/${url}`, body).pipe(
      catchError(this.errorHandler)
    );
  }

  private errorHandler(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error (e.g., network failure)
      errorMessage = `Client error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 400:
          errorMessage = `Bad Request: ${error.error.message || 'Invalid input'}`;
          break;
        case 404:
          errorMessage = `Not Found: ${error.error.message || 'Resource not found'}`;
          break;
        case 500:
          errorMessage = `Server Error: ${error.error.message || 'Internal server error'}`;
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.error.message || error.message}`;
      }
    }

    // Log for debugging
    console.error('HTTP Error:', {
      status: error.status,
      message: errorMessage,
      error: error.error
    });

    // Return a custom error object
    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      originalError: error
    }));
  }
}
