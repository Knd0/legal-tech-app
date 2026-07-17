import { Injectable, signal, effect, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { environment } from '../../../environments/environment';
import { catchError, of, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { DeadlineService } from './deadline.service';
import { CalendarEventService } from './calendar-event.service';

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
  readonly enableDesktop = signal<boolean>(true); // Default true

  private schedulerInterval: any = null;
  private notifiedEventIds = new Set<string>();
  private notifiedDeadlineIds = new Set<string>();
  private readonly SETTINGS_API = `${environment.apiUrl}/settings`;

  constructor(
    private swPush: SwPush,
    private http: HttpClient,
    private authService?: AuthService,
    private deadlineService?: DeadlineService,
    private calendarEventService?: CalendarEventService
  ) {
    this.checkSubscription();

    // Only run scheduler logic if dependencies are injected (allows unit testing with partial mocks)
    if (this.authService && this.deadlineService && this.calendarEventService) {
      this.loadNotifiedEvents();
      this.loadNotifiedDeadlines();

      try {
        effect(() => {
          const isAuth = this.authService?.isAuthenticated();
          if (isAuth) {
            // Add reactive dependencies on signals so that when events or deadlines are updated,
            // we instantly check for notifications
            this.calendarEventService?.events();
            this.deadlineService?.deadlines();
            
            this.checkAllNotifications();

            if (!this.schedulerInterval) {
              this.startScheduler();
            }
          } else {
            this.stopScheduler();
            this.notifiedEventIds.clear();
            this.notifiedDeadlineIds.clear();
          }
        });
      } catch (e) {
        console.warn('NotificationService: no se pudo crear el effect (probable contexto sin inyección de dependencias en test unitario)');
      }
    }
  }

  updateAlertSettings(days: number, hours: number, whatsapp: boolean, number: string, desktop: boolean) {
    const settings = {
        daysBeforeAlert: days,
        checkFrequencyHours: hours,
        enableWhatsapp: whatsapp,
        whatsappNumber: number,
        enableDesktop: desktop
    };

    this.http.post(this.SETTINGS_API, settings).subscribe({
        next: () => {
             this.daysBeforeAlert.set(days);
             this.checkFrequencyHours.set(hours);
             this.enableWhatsapp.set(whatsapp);
             this.whatsappNumber.set(number);
             this.enableDesktop.set(desktop);
        },
        error: (err) => console.error('Failed to save settings', err)
    });
  }

  public loadSettings() {
    this.http.get<any[]>(this.SETTINGS_API).subscribe({
        next: (settings) => {
            if (Array.isArray(settings)) {
                const days = settings.find(s => s.key === 'DAYS_BEFORE_ALERT')?.value;
                const hours = settings.find(s => s.key === 'CHECK_FREQUENCY_HOURS')?.value;
                const enable = settings.find(s => s.key === 'ENABLE_WHATSAPP')?.value;
                const number = settings.find(s => s.key === 'WHATSAPP_NUMBER')?.value;
                const desktop = settings.find(s => s.key === 'ENABLE_DESKTOP_NOTIFICATIONS')?.value;

                if (days) this.daysBeforeAlert.set(Number(days));
                if (hours) this.checkFrequencyHours.set(Number(hours));
                if (enable) this.enableWhatsapp.set(enable === '1');
                if (number) this.whatsappNumber.set(number);
                if (desktop) this.enableDesktop.set(desktop === '1');
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
      import('sweetalert2').then((Swal) => {
        Swal.default.fire({
          title: 'Notificaciones no soportadas',
          text: 'Tu navegador o entorno no soporta notificaciones Push en segundo plano (se requiere HTTPS en producción).',
          icon: 'info',
          confirmButtonText: 'Entendido'
        });
      });
      return;
    }

    this.http.get<{ publicKey: string }>(`${environment.apiUrl}/notifications/vapid-public-key`).subscribe({
      next: (res) => {
        const vapidKey = res.publicKey;
        
        this.swPush.requestSubscription({
          serverPublicKey: vapidKey
        })
        .then(sub => {
          console.log('Usuario suscrito a notificaciones:', sub);
          // Post subscription to backend
          this.http.post(`${environment.apiUrl}/notifications/subscribe`, sub).subscribe({
            next: () => {
              this.isSubscribed.set(true);
              import('sweetalert2').then((Swal) => {
                Swal.default.fire({
                  title: '¡Suscripción Exitosa!',
                  text: 'Recibirás notificaciones push incluso con la aplicación cerrada.',
                  icon: 'success',
                  timer: 2000,
                  showConfirmButton: false,
                  toast: true,
                  position: 'top-end'
                });
              });
            },
            error: (err) => {
              console.error('Error al guardar suscripción en backend', err);
              this.isSubscribed.set(false);
            }
          });
        })
        .catch(err => {
          console.error('No se pudo suscribir a notificaciones en navegador', err);
          this.isSubscribed.set(false);
        });
      },
      error: (err) => {
        console.error('Error al obtener la clave pública VAPID del servidor', err);
      }
    });
  }

  /**
   * Elimina la suscripción de notificaciones push del usuario en el navegador y el backend.
   */
  unsubscribeFromNotifications() {
    if (!this.swPush.isEnabled) return;

    this.swPush.subscription.subscribe({
      next: (sub) => {
        if (sub) {
          this.http.post(`${environment.apiUrl}/notifications/unsubscribe`, { endpoint: sub.endpoint }).subscribe({
            next: () => {
              sub.unsubscribe().then(() => {
                console.log('Usuario desuscrito de notificaciones push');
                this.isSubscribed.set(false);
              }).catch(err => console.error('Error al dar de baja en navegador', err));
            },
            error: (err) => console.error('Error al dar de baja en backend', err)
          });
        }
      }
    });
  }

  /**
   * Escucha notificaciones entrantes cuando la app está abierta.
   * (Nota: Las notificaciones en background las maneja el Service Worker automáticamente)
   */
  listenForMessages() {
    this.swPush.messages.subscribe((message: any) => {
      console.log('Notificación recibida en foreground:', message);
      
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
    });
  }

  private handleVencimientoAlert(notification: any) {
    alert(`URGENTE: ${notification.body}`); 
  }

  getWhatsappStatus() {
      return this.http.get<{ ready: boolean, qr: string | null, pairingCode?: string | null, error?: string | null }>(`${environment.apiUrl}/whatsapp/status`, {
          headers: { 'X-Skip-Loader': 'true' }
      });
  }


  logoutWhatsapp() {
      return this.http.post(`${environment.apiUrl}/whatsapp/logout`, {});
  }

  restartWhatsapp() {
      return this.http.post(`${environment.apiUrl}/whatsapp/restart`, {});
  }

  requestPairingCode(number: string) {
      return this.http.post<{ success: boolean, code: string }>(`${environment.apiUrl}/whatsapp/pairing-code`, { number });
  }

  private checkSubscription() {
    if (this.swPush.isEnabled) {
      this.swPush.subscription.subscribe(sub => {
        this.isSubscribed.set(!!sub);
      });
    }
  }

  // --- LOCAL DESKTOP SCHEDULER & NOTIFICATIONS ---

  private loadNotifiedEvents() {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem('legal_tech_notified_events');
      if (stored) {
        const parsed = JSON.parse(stored);
        const todayStr = new Date().toDateString();
        const filtered = Object.keys(parsed).reduce((acc, key) => {
          const dateStr = parsed[key];
          if (new Date(dateStr).toDateString() === todayStr) {
            acc[key] = dateStr;
          }
          return acc;
        }, {} as Record<string, string>);
        localStorage.setItem('legal_tech_notified_events', JSON.stringify(filtered));
        this.notifiedEventIds = new Set(Object.keys(filtered));
      }
    } catch (e) {
      console.error('Error loading notified events', e);
    }
  }

  private saveNotifiedEventsToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const todayStr = new Date().toDateString();
      const currentStored = localStorage.getItem('legal_tech_notified_events');
      const parsed = currentStored ? JSON.parse(currentStored) : {};
      this.notifiedEventIds.forEach(id => {
        if (!parsed[id]) parsed[id] = todayStr;
      });
      localStorage.setItem('legal_tech_notified_events', JSON.stringify(parsed));
    } catch (e) {
      console.error('Error saving notified events', e);
    }
  }

  private loadNotifiedDeadlines() {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem('legal_tech_notified_deadlines');
      if (stored) {
        const parsed = JSON.parse(stored);
        const todayStr = new Date().toDateString();
        const filtered = Object.keys(parsed).reduce((acc, key) => {
          const dateStr = parsed[key];
          if (new Date(dateStr).toDateString() === todayStr) {
            acc[key] = dateStr;
          }
          return acc;
        }, {} as Record<string, string>);
        localStorage.setItem('legal_tech_notified_deadlines', JSON.stringify(filtered));
        this.notifiedDeadlineIds = new Set(Object.keys(filtered));
      }
    } catch (e) {
      console.error('Error loading notified deadlines', e);
    }
  }

  private saveNotifiedDeadlinesToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const todayStr = new Date().toDateString();
      const currentStored = localStorage.getItem('legal_tech_notified_deadlines');
      const parsed = currentStored ? JSON.parse(currentStored) : {};
      this.notifiedDeadlineIds.forEach(id => {
        if (!parsed[id]) parsed[id] = todayStr;
      });
      localStorage.setItem('legal_tech_notified_deadlines', JSON.stringify(parsed));
    } catch (e) {
      console.error('Error saving notified deadlines', e);
    }
  }

  requestNativePermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Este navegador no soporta notificaciones de escritorio o no hay ventana activa.');
      return Promise.resolve(false);
    }
    return Notification.requestPermission().then(permission => {
      return permission === 'granted';
    });
  }

  startScheduler() {
    this.stopScheduler();
    
    // Run initial check after 3s to let the app load the services data
    setTimeout(() => {
      this.checkAllNotifications();
    }, 3000);
    
    this.schedulerInterval = setInterval(() => {
      this.checkAllNotifications();
    }, 60000);
  }

  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  checkAllNotifications() {
    this.checkCalendarEvents();
    this.checkDeadlines();
  }

  checkCalendarEvents() {
    if (!this.calendarEventService) return;
    const events = this.calendarEventService.events();
    const now = new Date();
    
    events.forEach(event => {
      if (!event.id) return;
      const eventDate = new Date(event.fecha);
      const diffMs = eventDate.getTime() - now.getTime();
      const diffMins = diffMs / (1000 * 60);

      // Starts in the next 15 minutes or started up to 5 minutes ago
      if (diffMins >= -5 && diffMins <= 15) {
        if (!this.notifiedEventIds.has(event.id)) {
          this.notifiedEventIds.add(event.id);
          this.saveNotifiedEventsToStorage();
          
          const timeStr = eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          this.triggerPopup(
            'Próximo Evento en Calendario',
            `El evento "${event.titulo}" comienza en breve (a las ${timeStr}).`,
            false
          );
        }
      }
    });
  }

  checkDeadlines() {
    if (!this.deadlineService) return;
    const deadlines = this.deadlineService.deadlines();
    const today = new Date();
    today.setHours(0,0,0,0);

    deadlines.forEach(d => {
      if (d.estado !== 'PENDIENTE' || !d.id) return;
      const deadlineDate = new Date(d.fechaVencimiento);
      deadlineDate.setHours(0,0,0,0);
      const diffTime = deadlineDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const daysAlert = this.daysBeforeAlert();

      if (diffDays <= daysAlert && diffDays >= 0) {
        const key = `${d.id}_${diffDays}`;
        if (!this.notifiedDeadlineIds.has(key)) {
          this.notifiedDeadlineIds.add(key);
          this.saveNotifiedDeadlinesToStorage();

          let title = 'Vencimiento Próximo';
          let body = `El vencimiento "${d.titulo}" expira en ${diffDays} días.`;
          if (diffDays === 0) {
            title = '⚠️ Vencimiento HOY';
            body = `¡ATENCIÓN! El vencimiento "${d.titulo}" expira HOY.`;
          } else if (diffDays === 1) {
            title = '⚠️ Vencimiento Mañana';
            body = `El vencimiento "${d.titulo}" expira mañana.`;
          }
          this.triggerPopup(title, body, d.esPerentorio || diffDays === 0);
        }
      }
    });
  }

  triggerPopup(title: string, bodyText: string, isUrgent: boolean = false) {
    // 1. Native Browser Notification
    if (this.enableDesktop() && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: bodyText,
          icon: '/favicon.ico'
        });
      } catch (err) {
        console.error('Error triggering native notification:', err);
      }
    }

    // 2. In-App SweetAlert2 Popup
    import('sweetalert2').then((Swal) => {
      if (isUrgent) {
        Swal.default.fire({
          title: `🔔 ${title}`,
          text: bodyText,
          icon: 'warning',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#3b82f6',
          timer: 20000,
          timerProgressBar: true
        });
      } else {
        Swal.default.fire({
          title: title,
          text: bodyText,
          icon: 'info',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 5000,
          timerProgressBar: true
        });
      }
    });
  }
}
