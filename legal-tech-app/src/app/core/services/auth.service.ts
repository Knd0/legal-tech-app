import { Injectable, signal } from '@angular/core';
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
                fullName: decoded.fullName,
                subscriptionStatus: decoded.subscriptionStatus,
                subscriptionExpiresAt: decoded.subscriptionExpiresAt
            });
        } else {
            this.logout();
        }
      } catch (e) {
        this.logout();
      }
    }
  }
}
