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

  // Allow access if active or trial, but check expiration
  if (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trial') {
    if (!user.subscriptionExpiresAt) return true;

    const expiry = new Date(user.subscriptionExpiresAt).getTime();
    const now = Date.now();
    const gracePeriodEnd = expiry + (7 * 24 * 60 * 60 * 1000); // 7 days

    // If within grace period, allow access (Creation blocked by components)
    if (now <= gracePeriodEnd) {
        return true;
    }
  }

  // Redirect to pricing page if strictly expired (past grace period)
  return router.createUrlTree(['/subscription/pricing']);
};
