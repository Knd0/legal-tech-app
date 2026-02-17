import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/']); // Redirect to home if already logged in
  }

  // Check storage in case signals aren't ready
  if (authService.getToken()) {
      return router.createUrlTree(['/']);
  }

  return true;
};
