import { Injectable, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { environment } from '../../../environments/environment';
import { catchError, of, tap } from 'rxjs';

import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  
  // Signal para exponer el estado de la suscripción a la UI si es necesario
  readonly isSubscribed = signal<boolean>(false);

  // Configuration
  readonly daysBeforeAlert = signal<number>(3); // Default 3 days
  readonly checkFrequencyHours = signal<number>(24); // Default 24 hours
  readonly enableWhatsapp = signal<boolean>(false); // Default false
  readonly whatsappNumber = signal<string>(''); // Default empty

  constructor(private swPush: SwPush, private http: HttpClient) {
    this.checkSubscription();
    this.loadSettings();
  }

  private readonly SETTINGS_API = `${environment.apiUrl}/settings`;

  updateAlertSettings(days: number, hours: number, whatsapp: boolean, number: string) {
    const settings = {
        daysBeforeAlert: days,
        checkFrequencyHours: hours,
        enableWhatsapp: whatsapp,
        whatsappNumber: number
    };

    this.http.post(this.SETTINGS_API, settings).subscribe({
        next: () => {
             this.daysBeforeAlert.set(days);
             this.checkFrequencyHours.set(hours);
             this.enableWhatsapp.set(whatsapp);
             this.whatsappNumber.set(number);
        },
        error: (err) => console.error('Failed to save settings', err)
    });
  }

  private loadSettings() {
    this.http.get<any>(this.SETTINGS_API).subscribe({
        next: (settings) => {
            if (settings) {
                this.daysBeforeAlert.set(settings.daysBeforeAlert || 3);
                this.checkFrequencyHours.set(settings.checkFrequencyHours || 24);
                this.enableWhatsapp.set(settings.enableWhatsapp || false);
                this.whatsappNumber.set(settings.whatsappNumber || '');
            }
        },
        error: (err) => console.error('Failed to load settings', err)
    });
  }

  /**
   * Generates the message template for WhatsApp
   */
  getNotificationTemplate(deadline: any, daysRemaining: number): string {
      return `📅 *Recordatorio Legal*\n` +
             `🔔 Vencimiento: *${deadline.titulo}*\n` +
             `⏳ Falta: *${daysRemaining} días*\n` +
             `📂 Desc: ${deadline.descripcion || 'Sin descripción'}\n` +
             `\n` +
             `*Sistema de Gestión Legal*`;
  }

  /**
   * Simulates sending a WhatsApp message by opening the API link
   */
  sendWhatsappMessage(number: string, text: string) {
      if (!number) return;
      
      const cleanNumber = number.replace(/\D/g, '');
      const body = { number: cleanNumber, message: text };

      // Try sending via Backend API (Bot)
      this.http.post<{success: boolean, message: string}>(`${environment.apiUrl}/whatsapp/send`, body).subscribe({
        next: (res) => {
            console.log('WhatsApp sent via backend', res);
            // SweetAlert for success (optional, or just toast)
            import('sweetalert2').then((Swal) => {
                Swal.default.fire({
                    title: 'Enviado',
                    text: 'Mensaje enviado por el Bot correctamente.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            });
        },
        error: (err) => {
          console.warn('Backend WhatsApp failed', err);
          
          import('sweetalert2').then((Swal) => {
            Swal.default.fire({
                title: 'Error del Bot',
                text: 'El bot no pudo enviar el mensaje automático. ¿Deseas abrir WhatsApp Web manualmente?',
                icon: 'error',
                showCancelButton: true,
                confirmButtonText: 'Sí, abrir WhatsApp Web',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
                    window.open(url, '_blank');
                }
            });
          });
        }
      });
  }

  /**
   * Intenta suscribir al usuario a notificaciones push.
   * Esto activará el diálogo de permisos del navegador.
   */
  subscribeToNotifications() {
    if (!this.swPush.isEnabled) {
      console.warn('Service Worker Push no está habilitado (¿Estás en localhost/HTTPS?)');
      return;
    }

    this.swPush.requestSubscription({
      serverPublicKey: environment.vapidPublicKey
    })
    .then(sub => {
      console.log('Usuario suscrito a notificaciones:', sub);
      this.isSubscribed.set(true);
      // AQUÍ SE DEBERÍA ENVIAR 'sub' AL BACKEND PARA GUARDARLO
      // this.http.post('/api/notifications/subscribe', sub).subscribe(...)
    })
    .catch(err => {
      console.error('No se pudo suscribir a notificaciones', err);
      this.isSubscribed.set(false);
    });
  }

  /**
   * Escucha notificaciones entrantes cuando la app está abierta.
   * (Nota: Las notificaciones en background las maneja el Service Worker automáticamente)
   */
  listenForMessages() {
    this.swPush.messages.subscribe((message: any) => {
      console.log('Notificación recibida en foreground:', message);
      
      // Lógica específica para alertas de vencimientos
      if (message.notification && message.notification.title === 'Vencimiento de plazo en 24hs') {
        this.handleVencimientoAlert(message.notification);
      }
    });
  }

  /**
   * Maneja el click en notificaciones
   */
  listenForNotificationClicks() {
    this.swPush.notificationClicks.subscribe(({ action, notification }) => {
      console.log('Click en notificación:', { action, notification });
      // Navegar a la pantalla del expediente, abrir modal, etc.
      // this.router.navigate(['/expedientes', notification.data.expedienteId]);
    });
  }

  private handleVencimientoAlert(notification: any) {
    // Aquí podrías mostrar un Toast/Snackbar de PrimeNG, actualizar un contador, etc.
    alert(`URGENTE: ${notification.body}`); 
  }

  getWhatsappStatus() {
      return this.http.get<{ ready: boolean, qr: string | null }>(`${environment.apiUrl}/whatsapp/status`);
  }

  logoutWhatsapp() {
      return this.http.post(`${environment.apiUrl}/whatsapp/logout`, {});
  }

  private checkSubscription() {
    if (this.swPush.isEnabled) {
      this.swPush.subscription.subscribe(sub => {
        this.isSubscribed.set(!!sub);
      });
    }
  }
}
