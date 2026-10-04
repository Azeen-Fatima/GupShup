import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, retry, switchMap, take, throwError, timer } from 'rxjs';
import { AuthService } from './auth.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Always enable credentials so cookies are sent
  let clonedReq = req.clone({
    withCredentials: true,
  });

  const token = authService.accessToken();
  if (token) {
    clonedReq = clonedReq.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  // Idempotent GET retry (max 2 tries, short backoff on network errors or 502/503/504)
  const source$ = next(clonedReq);
  const stream$ =
    req.method === 'GET'
      ? source$.pipe(
          retry({
            count: 2,
            delay: (error, retryCount) => {
              if (
                error instanceof HttpErrorResponse &&
                (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504)
              ) {
                return timer(retryCount * 400);
              }
              throw error;
            },
          })
        )
      : source$;

  return stream$.pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Do not attempt refresh on auth endpoints to prevent infinite loops
        const isAuthEndpoint =
          req.url.includes('/api/v1/auth/refresh') ||
          req.url.includes('/api/v1/auth/login') ||
          req.url.includes('/api/v1/auth/signup');

        if (isAuthEndpoint) {
          return throwError(() => error);
        }

        if (!isRefreshing) {
          isRefreshing = true;
          refreshTokenSubject.next(null);

          return authService.refreshSession().pipe(
            switchMap((newToken) => {
              isRefreshing = false;
              if (newToken) {
                refreshTokenSubject.next(newToken);
                return next(
                  req.clone({
                    withCredentials: true,
                    setHeaders: {
                      Authorization: `Bearer ${newToken}`,
                    },
                  })
                );
              }

              // Refresh failed
              authService.logout();
              router.navigate(['/login']);
              return throwError(() => error);
            }),
            catchError((refreshErr) => {
              isRefreshing = false;
              authService.logout();
              router.navigate(['/login']);
              return throwError(() => refreshErr);
            })
          );
        } else {
          // Wait for active refresh to complete
          return refreshTokenSubject.pipe(
            filter((newToken) => newToken !== null),
            take(1),
            switchMap((newToken) => {
              return next(
                req.clone({
                  withCredentials: true,
                  setHeaders: {
                    Authorization: `Bearer ${newToken}`,
                  },
                })
              );
            })
          );
        }
      }

      return throwError(() => error);
    })
  );
};
