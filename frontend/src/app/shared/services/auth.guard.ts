import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // If not initialized yet, attempt silent refresh once
  if (!authService.isInitialized()) {
    authService.isInitialized.set(true);
    return authService.refreshSession().pipe(
      map((token) => {
        if (token) {
          return true;
        }
        // If refresh failed (e.g. offline) but user has saved profile locally, allow offline entry
        if (authService.hasLocalUser()) {
          return true;
        }
        router.navigate(['/login']);
        return false;
      })
    );
  }

  // Allow offline access if user has local profile
  if (authService.hasLocalUser()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() || authService.hasLocalUser()) {
    router.navigate(['/chats']);
    return false;
  }

  if (!authService.isInitialized()) {
    authService.isInitialized.set(true);
    return authService.refreshSession().pipe(
      map((token) => {
        if (token || authService.hasLocalUser()) {
          router.navigate(['/chats']);
          return false;
        }
        return true;
      })
    );
  }

  return true;
};
