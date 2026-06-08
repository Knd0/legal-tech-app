import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { SubscriptionService } from '../services/subscription.service';

export const subscriptionGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const subscriptionService = inject(SubscriptionService);
  const router = inject(Router);

  if (!authService.currentUser()) {
    return router.createUrlTree(['/auth/login']);
  }

  return subscriptionService.canAccessApp()
    ? true
    : router.createUrlTree(['/subscription/pricing']);
};
