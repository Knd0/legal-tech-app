import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth.service';

type PageState = 'loading' | 'success' | 'pending' | 'failure';

@Component({
  selector: 'app-subscription-success',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './success.html'
})
export class Success implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  state = signal<PageState>('loading');
  retrying = signal(false);

  ngOnInit() {
    this.verifySubscription();
  }

  verifySubscription() {
    this.http.get<{ status: string; expiresAt: string | null }>(`${environment.apiUrl}/mercadopago/subscription`)
      .subscribe({
        next: (res) => {
          const user = this.authService.currentUser();
          this.authService.currentUser.set({
            ...user,
            subscriptionStatus: res.status,
            subscriptionExpiresAt: res.expiresAt,
          });

          if (res.status === 'active') {
            this.state.set('success');
          } else if (res.status === 'cancelled') {
            this.state.set('failure');
          } else {
            this.state.set('pending');
          }
        },
        error: () => {
          this.state.set('pending');
        }
      });
  }

  retry() {
    this.retrying.set(true);
    this.state.set('loading');
    setTimeout(() => {
      this.retrying.set(false);
      this.verifySubscription();
    }, 2000);
  }

  goToPricing() {
    this.router.navigate(['/subscription/pricing']);
  }
}
