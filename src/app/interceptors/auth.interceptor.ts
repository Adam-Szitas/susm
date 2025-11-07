import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserStore } from '../store/user.store'; // Adjust the path as needed

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  #userStore = inject(UserStore);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.#userStore.token();

    // Optionally skip auth for some endpoints
    const isAuthFree = req.url.includes('/login') || req.url.includes('/register');

    if (token && !isAuthFree) {
      const cloned = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
      return next.handle(cloned);
    }

    const cloned = req.clone({
      setHeaders: {
        'Content-type': 'application/json',
      },
    });
    return next.handle(cloned);
  }
}
