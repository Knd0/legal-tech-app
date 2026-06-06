import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule, Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './pricing.html'
})
export class Pricing implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  authService = inject(AuthService);

  loading = signal<'basic' | 'pro' | 'reactivate' | null>(null);

  get status() {
    return this.authService.currentUser()?.subscriptionStatus ?? 'trial';
  }

  ngOnInit() {}

  subscribeBasic() { this.createSubscription('basic'); }
  subscribePro()   { this.createSubscription('pro'); }

  private createSubscription(planType: string) {
    this.loading.set(planType as 'basic' | 'pro');
    this.http.post<{ preapprovalLink: string }>(`${environment.apiUrl}/mercadopago/create-subscription`, { plan: planType })
      .subscribe({
        next: (res) => {
          if (res.preapprovalLink) {
            window.location.href = res.preapprovalLink;
          } else {
            this.loading.set(null);
            Swal.fire('Error', 'No se pudo generar el link de pago.', 'error');
          }
        },
        error: () => {
          this.loading.set(null);
          Swal.fire('Error', 'Error de conexión con MercadoPago. Intentá de nuevo.', 'error');
        }
      });
  }

  reactivate() {
    Swal.fire({
      title: 'Reactivar suscripción',
      text: '¿Querés reactivar tu suscripción? Se reanudará el cobro automático.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, reactivar',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (!result.isConfirmed) return;
      this.loading.set('reactivate');
      this.http.post<{ success: boolean }>(`${environment.apiUrl}/mercadopago/reactivate-subscription`, {}).subscribe({
        next: () => {
          this.loading.set(null);
          const user = this.authService.currentUser();
          this.authService.currentUser.set({ ...user, subscriptionStatus: 'active' });
          Swal.fire('¡Reactivada!', 'Tu suscripción está activa nuevamente.', 'success');
        },
        error: (err) => {
          this.loading.set(null);
          Swal.fire('Error', err.error?.message || 'No se pudo reactivar la suscripción.', 'error');
        }
      });
    });
  }

  simulatePayment() {
    this.loading.set('pro');
    this.http.post<{ success: boolean }>(`${environment.apiUrl}/mercadopago/simulate-payment`, {})
      .subscribe({
        next: (res) => {
          this.loading.set(null);
          if (res.success) {
            Swal.fire({
              icon: 'success',
              title: 'Pago Simulado',
              text: '¡Redirigiendo a la pantalla de confirmación!',
              timer: 1500,
              showConfirmButton: false
            }).then(() => {
              const user = this.authService.currentUser();
              if (user) {
                this.authService.currentUser.set({
                  ...user,
                  subscriptionStatus: 'active'
                });
              }
              this.router.navigate(['/subscription/success']);
            });
          }
        },
        error: (err) => {
          this.loading.set(null);
          Swal.fire('Error', err.error?.message || 'Error al intentar simular el pago.', 'error');
        }
      });
  }
}
