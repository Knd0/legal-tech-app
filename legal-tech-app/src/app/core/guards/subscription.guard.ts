import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const subscriptionGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const user = authService.currentUser();
  
  if (!user) {
    return router.createUrlTree(['/auth/login']);
  }

  // Admins bypass subscription checks
  if (user.role === 'ADMIN') {
    return true;
  }

  // Allow access if active or trial
  if (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trial') {
    return true;
  }

  // Redirect to pricing page if expired, cancelled, paused etc
  return router.createUrlTree(['/subscription/pricing']);
};
