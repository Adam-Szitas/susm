import { Injectable, inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { UserStore } from '../store/user.store';
import { shouldLogoutOnHttpError, isSessionRenewRequestUrl } from '../utils/auth-http-error';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  #userStore = inject(UserStore);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.#userStore.token();

    const isAuthFree =
      req.url.includes('/login') ||
      req.url.includes('/register') ||
      req.url.includes('/public/registration-invite');

    const outgoing: HttpRequest<unknown> =
      token && !isAuthFree
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req.clone({ setHeaders: { 'Content-type': 'application/json' } });

    return next.handle(outgoing).pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse) {
          const onLoginPage =
            typeof window !== 'undefined' && window.location.pathname.startsWith('/login');
          if (
            !onLoginPage &&
            !isSessionRenewRequestUrl(req.url) &&
            shouldLogoutOnHttpError(err, req.url) &&
            this.#userStore.isAuthenticated()
          ) {
            this.#userStore.logout();
          }
        }
        return throwError(() => err);
      }),
    );
  }
}
