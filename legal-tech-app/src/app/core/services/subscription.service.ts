import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private authService = inject(AuthService);

  isSubscriptionExpired = computed(() => {
    const user = this.authService.currentUser();
    if (!user || user.role === 'ADMIN') return false;
    if (!user.subscriptionExpiresAt) return false;
    return new Date(user.subscriptionExpiresAt).getTime() < Date.now();
  });

  isGracePeriod = computed(() => {
    const user = this.authService.currentUser();
    if (!user || user.role === 'ADMIN') return false;
    if (!user.subscriptionExpiresAt) return false;
    const expiry = new Date(user.subscriptionExpiresAt).getTime();
    const now = Date.now();
    return now > expiry && now <= expiry + GRACE_PERIOD_MS;
  });

  isCreationBlocked = computed(() => {
    const user = this.authService.currentUser();
    if (!user || user.role === 'ADMIN') return false;
    if (user.subscriptionStatus !== 'active' && user.subscriptionStatus !== 'trial') return true;
    return this.isSubscriptionExpired();
  });

  // Used by subscriptionGuard: allows access during grace period, blocks after
  canAccessApp = computed(() => {
    const user = this.authService.currentUser();
    if (!user || user.role === 'ADMIN') return true;
    if (user.subscriptionStatus !== 'active' && user.subscriptionStatus !== 'trial') return false;
    if (!user.subscriptionExpiresAt) return true;
    return Date.now() <= new Date(user.subscriptionExpiresAt).getTime() + GRACE_PERIOD_MS;
  });
}
