import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pricing.html'
})
export class Pricing {
  loading = false;

  constructor(private http: HttpClient) {}

  subscribeBasic() {
    this.createSubscription('basic');
  }

  subscribePro() {
    this.createSubscription('pro');
  }

  private createSubscription(planType: string) {
    this.loading = true;
    this.http.post<{preapprovalLink: string}>(`${environment.apiUrl}/mercadopago/create-subscription`, { plan: planType })
      .subscribe({
        next: (res) => {
          if (res.preapprovalLink) {
             window.location.href = res.preapprovalLink;
          } else {
             this.loading = false;
             alert('Error al generar el link de pago.');
          }
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
          alert('Error de conexión con MercadoPago.');
        }
      });
  }
}
