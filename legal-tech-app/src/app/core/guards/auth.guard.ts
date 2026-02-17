import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Check if token exists in storage but signals not yet updated (page reload)
  if (authService.getToken()) {
      return true;
  }

  return router.createUrlTree(['/auth/login']);
};
