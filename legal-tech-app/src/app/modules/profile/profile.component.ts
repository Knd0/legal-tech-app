import { Component, OnInit, inject, signal, OnDestroy, NgZone, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule, FormsModule, ButtonModule, InputTextModule, DialogModule, CheckboxModule, TooltipModule, RouterModule],
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit, OnDestroy {
  fb = inject(FormBuilder);
  http = inject(HttpClient);
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  private ngZone = inject(NgZone);

  profileForm: FormGroup;
  afipForm: FormGroup;
  securityForm: FormGroup;

  saving = signal<boolean>(false);
  savingAfip = signal<boolean>(false);
  cancellingSubscription = signal<boolean>(false);
  reactivating = signal<boolean>(false);
  subscriptionData = signal<{ status: string; expiresAt: string | null; mpSubscriptionId: string | null } | null>(null);
  paymentHistory = signal<any[]>([]);

  // Integrations State
  isAfipLinked = signal<boolean>(false);
  editAfipMode = signal<boolean>(false);
  qrCodeUrl = signal<string | null>(null);
  private qrPollInterval: any;
  
  configDays: number = 3;
  configHours: number = 24;
  configWhatsapp: boolean = false;
  configWhatsappNumber: string = '';
  configDesktop: boolean = true;

  // Security Modal
  showSecurityModal = false;
  otpSent = false;
  
  whatsappError = signal<string | null>(null);

  private apiUrl = `${environment.apiUrl}/users/profile`;

  constructor() {
    this.profileForm = this.fb.group({
      fullName: ['', Validators.required],
      email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
      phoneNumber: [''],
      cuit: [''],
      address: [''],
      role: [{ value: '', disabled: true }],
      
      // AFIP Fields
      iibb: [''],
      initActivityUser: [''],
      puntoVenta: [null, Validators.required],
      condicionIva: ['Resp. Monotributo']
    });

    this.afipForm = this.fb.group({
      cuit: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
      iibb: [''],
      initActivityUser: [''],
      puntoVenta: [null, Validators.required],
      condicionIva: ['Resp. Monotributo']
    });

    this.securityForm = this.fb.group({
        otp: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[a-zA-Z]).{8,}$/)]],
        confirmPassword: ['', Validators.required]
    });

    // Reactively update local form fields when notification settings change in the service
    effect(() => {
      this.configDays = this.notificationService.daysBeforeAlert();
      this.configHours = this.notificationService.checkFrequencyHours();
      const enabled = this.notificationService.enableWhatsapp();
      this.configWhatsapp = enabled;
      this.configWhatsappNumber = this.notificationService.whatsappNumber();
      this.configDesktop = this.notificationService.enableDesktop();

      // Start/stop polling based on settings state
      if (enabled) {
        this.ngZone.run(() => {
          if (!this.qrPollInterval) {
            this.startQrPolling();
          }
        });
      } else {
        this.ngZone.run(() => {
          this.stopQrPolling();
        });
      }
    });
  }

  ngOnInit() {
    this.loadProfile();
    this.loadSubscription();
    this.notificationService.loadSettings();
  }

  loadSubscription() {
    this.http.get<any>(`${environment.apiUrl}/mercadopago/subscription`).subscribe({
      next: (data) => {
        this.subscriptionData.set(data);
        if (data.status === 'active' || data.status === 'paused') {
          this.loadPaymentHistory();
        }
      },
      error: (err) => console.error('Error loading subscription', err)
    });
  }

  loadPaymentHistory() {
    this.http.get<{ payments: any[] }>(`${environment.apiUrl}/mercadopago/payment-history`).subscribe({
      next: (res) => this.paymentHistory.set(res.payments),
      error: (err) => console.error('Error loading payment history', err)
    });
  }

  reactivateSubscription() {
    this.reactivating.set(true);
    this.http.post<{ success: boolean }>(`${environment.apiUrl}/mercadopago/reactivate-subscription`, {}).subscribe({
      next: () => {
        this.reactivating.set(false);
        const user = this.authService.currentUser();
        this.authService.currentUser.set({ ...user, subscriptionStatus: 'active' });
        this.subscriptionData.set({ ...this.subscriptionData()!, status: 'active' });
        Swal.fire({ icon: 'success', title: '¡Reactivada!', text: 'Tu suscripción está activa nuevamente.', timer: 2000, showConfirmButton: false });
      },
      error: (err) => {
        this.reactivating.set(false);
        Swal.fire('Error', err.error?.message || 'No se pudo reactivar la suscripción.', 'error');
      }
    });
  }

  cancelSubscription() {
    Swal.fire({
      title: 'Cancelar Suscripción',
      text: '¿Estás seguro? Perderás acceso a las funciones Pro al finalizar el período actual.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#dc2626',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.cancellingSubscription.set(true);
      this.http.post(`${environment.apiUrl}/mercadopago/cancel-subscription`, {}).subscribe({
        next: () => {
          this.cancellingSubscription.set(false);
          const currentUser = this.authService.currentUser();
          this.authService.currentUser.set({ ...currentUser, subscriptionStatus: 'cancelled' });
          this.subscriptionData.set({ ...this.subscriptionData()!, status: 'cancelled' });
          Swal.fire({
            icon: 'success',
            title: 'Suscripción Cancelada',
            text: 'Tu suscripción ha sido cancelada correctamente.',
            timer: 2500,
            showConfirmButton: false,
          });
        },
        error: () => {
          this.cancellingSubscription.set(false);
          Swal.fire('Error', 'No se pudo cancelar la suscripción.', 'error');
        }
      });
    });
  }

  loadProfile() {
    this.http.get<any>(this.apiUrl).subscribe({
        next: (user: any) => {
            if (user) {
                let dateStr = user.initActivityUser;
                if (dateStr && typeof dateStr === 'string' && dateStr.includes('T')) {
                    dateStr = dateStr.split('T')[0];
                }

                this.profileForm.patchValue({
                    fullName: user.fullName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    address: user.address,
                    cuit: user.cuit,
                    role: user.role
                });

                this.afipForm.patchValue({
                    cuit: user.cuit,
                    iibb: user.iibb,
                    initActivityUser: dateStr,
                    puntoVenta: user.puntoVenta,
                    condicionIva: user.condicionIva || 'Resp. Monotributo'
                });

                if (user.cuit && user.puntoVenta) {
                    this.isAfipLinked.set(true);
                } else {
                    this.isAfipLinked.set(false);
                    this.editAfipMode.set(true); // Open edit mode by default if not linked
                }
            }
        },
        error: (err: any) => console.error('Error loading profile', err)
    });
  }

  onSubmit() {
    if (this.profileForm.invalid) {
        this.profileForm.markAllAsTouched();
        return;
    }

    this.saving.set(true);
    const data = this.profileForm.getRawValue();
    const payload = {
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        address: data.address
    };

    this.http.patch(this.apiUrl, payload).subscribe({
        next: () => {
            this.saving.set(false);
            Swal.fire({
                icon: 'success',
                title: 'Perfil Actualizado',
                text: 'Tus datos se han guardado correctamente.',
                timer: 2000,
                showConfirmButton: false
            });
            const currentUser = this.authService.currentUser();
            this.authService.currentUser.set({ ...currentUser, ...payload });
        },
        error: (err: any) => {
            this.saving.set(false);
            console.error('Error updating profile', err);
            Swal.fire('Error', 'No se pudieron guardar los cambios', 'error');
        }
    });
  }

  saveAfip() {
      if (this.afipForm.invalid) {
          this.afipForm.markAllAsTouched();
          return;
      }

      this.savingAfip.set(true);
      const data = this.afipForm.getRawValue();
      const payload = {
          cuit: data.cuit,
          iibb: data.iibb,
          initActivityUser: data.initActivityUser,
          puntoVenta: data.puntoVenta,
          condicionIva: data.condicionIva
      };

      this.http.patch(this.apiUrl, payload).subscribe({
          next: () => {
              this.savingAfip.set(false);
              this.isAfipLinked.set(true);
              this.editAfipMode.set(false);
              Swal.fire({
                  icon: 'success',
                  title: 'AFIP Vinculado',
                  text: 'Tus datos fiscales se han guardado correctamente.',
                  timer: 2000,
                  showConfirmButton: false
              });
              const currentUser = this.authService.currentUser();
              this.authService.currentUser.set({ ...currentUser, ...payload });
          },
          error: (err: any) => {
              this.savingAfip.set(false);
              console.error('Error updating AFIP', err);
              Swal.fire('Error', 'No se pudieron guardar los datos fiscales', 'error');
          }
      });
  }
  
  unlinkAfip() {
      Swal.fire({
          title: 'Desvincular AFIP',
          text: '¿Estás seguro? No podrás emitir facturas si eliminas esta configuración.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí, desvincular'
      }).then((result) => {
          if (result.isConfirmed) {
              const payload = {
                  cuit: null,
                  iibb: null,
                  initActivityUser: null,
                  puntoVenta: null,
                  condicionIva: null
              };
              
              this.http.patch(this.apiUrl, payload).subscribe({
                  next: () => {
                      this.afipForm.reset({ condicionIva: 'Resp. Monotributo' });
                      this.isAfipLinked.set(false);
                      this.editAfipMode.set(true);
                      Swal.fire('Desvinculado', 'Se han eliminado tus datos fiscales.', 'success');
                      const currentUser = this.authService.currentUser();
                      this.authService.currentUser.set({ ...currentUser, ...payload });
                  },
                  error: () => Swal.fire('Error', 'No se pudo desvincular AFIP.', 'error')
              });
          }
      });
  }

  // --- INTEGRATIONS ---

  async onDesktopToggle(event: any) {
      if (this.configDesktop) {
          const granted = await this.notificationService.requestNativePermission();
          if (!granted) {
              this.configDesktop = false;
              Swal.fire({
                  icon: 'warning',
                  title: 'Permiso Denegado',
                  text: 'Para activar las notificaciones pop-up, debes habilitar los permisos de notificación en tu navegador.',
                  confirmButtonText: 'Entendido'
              });
          } else {
              this.notificationService.subscribeToNotifications();
          }
      } else {
          this.notificationService.unsubscribeFromNotifications();
      }
  }

  saveIntegrations() {
      this.notificationService.updateAlertSettings(
          this.configDays,
          this.configHours,
          this.configWhatsapp,
          this.configWhatsappNumber,
          this.configDesktop
      );
      Swal.fire({
          icon: 'success',
          title: 'Configuración Guardada',
          timer: 1500,
          showConfirmButton: false
      });

      if (this.configWhatsapp && !this.qrCodeUrl() && !this.qrPollInterval) {
          this.startQrPolling();
      } else if (!this.configWhatsapp) {
          this.stopQrPolling();
      }
  }



  stopQrPolling() {
      if (this.qrPollInterval) {
          clearInterval(this.qrPollInterval);
          this.qrPollInterval = null;
      }
  }

  ngOnDestroy() {
      this.stopQrPolling();
  }

  logoutWhatsapp() {
      Swal.fire({
          title: 'Desconectar WhatsApp',
          text: '¿Estás seguro?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí, desconectar'
      }).then((result) => {
          if (result.isConfirmed) {
               this.notificationService.logoutWhatsapp().subscribe({
                  next: () => {
                      Swal.fire('Desconectado', 'Sesión cerrada.', 'success');
                      this.qrCodeUrl.set(null);
                      this.configWhatsappNumber = '';
                      this.notificationService.updateAlertSettings(this.configDays, this.configHours, this.configWhatsapp, '', this.configDesktop);
                      if (this.configWhatsapp) this.startQrPolling();
                  },
                  error: () => Swal.fire('Error', 'No se pudo cerrar la sesión.', 'error')
              });
          }
      });
  }

  loadingQr = signal<boolean>(false);
  scannedAndProcessing = signal<boolean>(false);
  pairingCode = signal<string | null>(null);
  loadingPairingCode = signal<boolean>(false);

  restartWhatsapp() {
      this.loadingQr.set(true);
      this.scannedAndProcessing.set(false);
      this.notificationService.restartWhatsapp().subscribe({
          next: () => {
              this.qrCodeUrl.set(null);
              this.pairingCode.set(null);
              this.whatsappError.set(null);
              this.startQrPolling();
          },
          error: () => {
              this.loadingQr.set(false);
              Swal.fire('Error', 'No se pudo generar el QR.', 'error');
          }
      });
  }

  generatePairingCode() {
      const phone = this.profileForm.get('phoneNumber')?.value;
      if (!phone) {
          Swal.fire('Atención', 'Debes ingresar tu número de teléfono en el perfil para usar este método.', 'warning');
          return;
      }
      
      this.loadingPairingCode.set(true);
      this.scannedAndProcessing.set(false);
      this.notificationService.requestPairingCode(phone).subscribe({
          next: (res) => {
              this.loadingPairingCode.set(false);
              if (res.success && res.code) {
                  this.pairingCode.set(res.code);
                  this.qrCodeUrl.set(null);
                  this.startQrPolling(5000);
              }
          },
          error: (err) => {
              this.loadingPairingCode.set(false);
              console.error(err);
              Swal.fire('Error', 'No se pudo generar el código. Asegúrate que el bot se haya reiniciado primero (usa el botón Generar QR primero para iniciar el proceso).', 'error');
          }
      });
  }

  startQrPolling(intervalMs = 3000) {
      this.stopQrPolling();
      
      // If we don't have a connected number and we aren't pairing with a code or already scanned,
      // let's show the loading/generating QR state from the start!
      if (!this.configWhatsappNumber && !this.pairingCode() && !this.scannedAndProcessing()) {
          this.loadingQr.set(true);
      }

      let consecutiveErrors = 0;
      const maxPolls = Math.ceil(120_000 / intervalMs);
      let pollCount = 0;

      this.ngZone.runOutsideAngular(() => {
        this.qrPollInterval = setInterval(() => {
          if (++pollCount > maxPolls) {
            this.ngZone.run(() => {
              this.stopQrPolling();
              this.loadingQr.set(false);
              this.scannedAndProcessing.set(false);
              this.whatsappError.set('Tiempo de espera agotado. Intentá de nuevo.');
            });
            return;
          }

          this.notificationService.getWhatsappStatus().subscribe({
            next: (status: any) => {
              this.ngZone.run(() => {
                consecutiveErrors = 0;

                if (status.qr) {
                  this.qrCodeUrl.set(status.qr);
                  this.loadingQr.set(false);
                  this.scannedAndProcessing.set(false);
                } else if (status.ready) {
                  const wasLinking = this.loadingQr() || this.scannedAndProcessing() || this.loadingPairingCode() || this.pairingCode();
                  
                  this.qrCodeUrl.set(null);
                  this.pairingCode.set(null);
                  this.whatsappError.set(null);
                  this.loadingQr.set(false);
                  this.scannedAndProcessing.set(false);
                  this.stopQrPolling();

                  if (status.number && !this.configWhatsappNumber) {
                    this.configWhatsappNumber = status.number;
                    this.notificationService.updateAlertSettings(
                      this.configDays,
                      this.configHours,
                      this.configWhatsapp,
                      status.number,
                      this.configDesktop
                    );
                  }

                  if (wasLinking) {
                    Swal.fire({
                      title: '¡Conectado!',
                      text: status.number ? `Vinculado con ${status.number}` : 'El bot de WhatsApp está listo.',
                      icon: 'success',
                      timer: 3000,
                      showConfirmButton: false
                    });
                  }
                } else if (status.error) {
                  this.whatsappError.set(status.error);
                  this.loadingQr.set(false);
                  this.scannedAndProcessing.set(false);
                  this.stopQrPolling();
                } else {
                  // status.qr is null AND status.ready is false
                  // If we had a QR code showing, it means it was scanned!
                  if (this.qrCodeUrl()) {
                    this.qrCodeUrl.set(null);
                    this.scannedAndProcessing.set(true);
                    this.loadingQr.set(false);
                  }
                }
              });
            },
            error: (err: any) => {
              this.ngZone.run(() => {
                if (err.status === 401) {
                  this.stopQrPolling();
                  this.loadingQr.set(false);
                  this.scannedAndProcessing.set(false);
                  this.whatsappError.set('Sesión expirada. Volvé a iniciar sesión.');
                  return;
                }

                consecutiveErrors++;
                console.warn(`Polling error (${consecutiveErrors}):`, err);

                if (consecutiveErrors >= 5) {
                  this.stopQrPolling();
                  this.loadingQr.set(false);
                  this.scannedAndProcessing.set(false);
                  this.whatsappError.set('No se pudo conectar con el servidor. Intentá de nuevo.');
                } else if (consecutiveErrors >= 3 && intervalMs < 10_000) {
                  this.startQrPolling(10_000);
                }
              });
            }
          });
        }, intervalMs);
      });
  }

  sendTestMessage() {
      if (!this.configWhatsappNumber) {
          Swal.fire('Error', 'Ingrese un número de WhatsApp válido.', 'error');
          return;
      }
      this.notificationService.sendWhatsappMessage(this.configWhatsappNumber, 'Hola! Esta es una prueba de notificación desde tu Perfil.');
  }



  // --- SECURITY ---

  openSecurityModal() {
      const phone = this.profileForm.get('phoneNumber')?.value;
      if (!phone) {
          Swal.fire({
              title: 'Número Requerido',
              text: 'Debes vincular un número de teléfono en tu perfil antes de cambiar la contraseña.',
              icon: 'warning'
          });
          return;
      }
      this.securityForm.reset();
      this.otpSent = false;
      this.showSecurityModal = true;
  }

  requestOtp() {
      this.authService.requestPasswordOtp().subscribe({
          next: () => {
              this.otpSent = true;
              Swal.fire('Código Enviado', 'Revisa tu WhatsApp para ver el código de verificación.', 'success');
          },
          error: (err) => Swal.fire('Error', 'No se pudo enviar el código. ' + (err.error?.message || ''), 'error')
      });
  }

  changePassword() {
      if (this.securityForm.invalid) return;
      const { otp, newPassword, confirmPassword } = this.securityForm.value;

      if (newPassword !== confirmPassword) {
          Swal.fire('Error', 'Las contraseñas no coinciden.', 'error');
          return;
      }

      this.authService.changePassword(otp, newPassword).subscribe({
          next: () => {
              this.showSecurityModal = false;
              Swal.fire('Contraseña Actualizada', 'Tu contraseña se ha cambiado correctamente.', 'success');
          },
          error: (err) => Swal.fire('Error', 'No se pudo cambiar la contraseña. ' + (err.error?.message || ''), 'error')
      });
  }
}
