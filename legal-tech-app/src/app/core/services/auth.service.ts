import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private tokenKey = 'auth_token';
  
  // Signals for reactive state
  currentUser = signal<any>(null);
  isAuthenticated = signal<boolean>(false);

  // Subscription Signals
  isSubscriptionExpired = computed(() => {
    const user = this.currentUser();
    if (!user || user.role === 'ADMIN') return false;
    if (!user.subscriptionExpiresAt) return false;
    return new Date(user.subscriptionExpiresAt).getTime() < Date.now();
  });

  isProUser = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return (user.subscriptionStatus === 'active' && user.subscriptionPlan !== 'basic') || user.subscriptionStatus === 'trial';
  });

  isGracePeriod = computed(() => {
    const user = this.currentUser();
    if (!user || user.role === 'ADMIN') return false;
    if (!user.subscriptionExpiresAt) return false;
    const expiry = new Date(user.subscriptionExpiresAt).getTime();
    const now = Date.now();
    const gracePeriodEnd = expiry + (7 * 24 * 60 * 60 * 1000); // 7 days
    return now > expiry && now <= gracePeriodEnd;
  });

  isCreationBlocked = computed(() => {
    const user = this.currentUser();
    if (!user || user.role === 'ADMIN') return false;
    
    // If status is not active/trial, it's blocked
    if (user.subscriptionStatus !== 'active' && user.subscriptionStatus !== 'trial') {
        return true;
    }

    // If it's expired (even in grace period), block creation
    return this.isSubscriptionExpired();
  });

  constructor(private http: HttpClient, private router: Router) {
    this.loadUserFromToken();
  }

  login(email: string, pass: string) {
    return this.http.post<{ access_token: string, user: any }>(`${this.apiUrl}/login`, { email, password: pass })
      .pipe(
        tap(response => {
          localStorage.setItem(this.tokenKey, response.access_token);
          this.isAuthenticated.set(true);
          this.currentUser.set(response.user);
          
          if (response.user.role === 'ADMIN') {
              this.router.navigate(['/admin/users']);
          } else {
              this.router.navigate(['/dashboard']);
          }
        })
      );
  }
  register(email: string, pass: string, fullName: string, phoneNumber?: string) {
    return this.http.post(`${this.apiUrl}/register`, { email, password: pass, fullName, phoneNumber });
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // OTP methods removed as requested

  requestPasswordOtp() {
      return this.http.post(`${this.apiUrl}/request-password-otp`, {});
  }

  changePassword(otp: string, newPass: string) {
      return this.http.post(`${this.apiUrl}/change-password`, { otp, newPassword: newPass });
  }

  refreshProfile() {
    if (!this.isAuthenticated()) return;
    this.http.get<any>(`${environment.apiUrl}/users/profile`).subscribe({
      next: (user) => {
        if (user) {
          this.currentUser.set(user);
        }
      },
      error: (err) => {
        console.error('Failed to refresh user profile:', err);
      }
    });
  }

  private loadUserFromToken() {
    const token = this.getToken();
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        const isExpired = decoded.exp * 1000 < Date.now();
        if (!isExpired) {
            this.isAuthenticated.set(true);
            this.currentUser.set({
                id: decoded.sub,
                email: decoded.username,
                role: decoded.role,
                phoneNumber: decoded.phoneNumber,
                isPhoneVerified: decoded.isPhoneVerified || false,
                daysBeforeAlert: decoded.daysBeforeAlert !== undefined ? decoded.daysBeforeAlert : 1,
                fullName: decoded.fullName,
                subscriptionStatus: decoded.subscriptionStatus,
                subscriptionPlan: decoded.subscriptionPlan || 'pro',
                subscriptionExpiresAt: decoded.subscriptionExpiresAt
            });
            setTimeout(() => this.refreshProfile(), 0);
        } else {
            this.logout();
        }
      } catch (e) {
        this.logout();
      }
    }
  }
}
