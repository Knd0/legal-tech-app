import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import Swal from 'sweetalert2';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ButtonModule, InputTextModule, DialogModule, CheckboxModule, TooltipModule],
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit, OnDestroy {
  fb = inject(FormBuilder);
  http = inject(HttpClient);
  authService = inject(AuthService);
  notificationService = inject(NotificationService);


  profileForm: FormGroup;
  securityForm: FormGroup;

  saving = signal<boolean>(false);
  
  // Integrations State
  qrCodeUrl: string | null = null;
  private qrPollInterval: any;
  
  configDays: number = 3;
  configHours: number = 24;
  configWhatsapp: boolean = false;
  configWhatsappNumber: string = '';

  // Security Modal
  showSecurityModal = false;
  otpSent = false;

  private apiUrl = `${environment.apiUrl}/users/profile`;

  constructor() {
    this.profileForm = this.fb.group({
      fullName: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      phoneNumber: [''],
      cuit: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
      address: ['', Validators.required],
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
  }

  ngOnInit() {
    this.loadProfile();
    
    // Load Integration Settings
    this.configDays = this.notificationService.daysBeforeAlert();
    this.configHours = this.notificationService.checkFrequencyHours();
    this.configWhatsapp = this.notificationService.enableWhatsapp();
    this.configWhatsappNumber = this.notificationService.whatsappNumber();
  }

  loadProfile() {
    this.http.get<any>(this.apiUrl).subscribe({
        next: (user) => {
            if (user) {
                let dateStr = user.initActivityUser;
                if (dateStr && typeof dateStr === 'string' && dateStr.includes('T')) {
                    dateStr = dateStr.split('T')[0];
                }

                this.profileForm.patchValue({
                    fullName: user.fullName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    cuit: user.cuit,
                    address: user.address,
                    iibb: user.iibb,
                    initActivityUser: dateStr,
                    puntoVenta: user.puntoVenta,
                    condicionIva: user.condicionIva || 'Resp. Monotributo'
                });
            }
        },
        error: (err) => console.error('Error loading profile', err)
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
        cuit: data.cuit,
        address: data.address,
        iibb: data.iibb,
        initActivityUser: data.initActivityUser,
        puntoVenta: data.puntoVenta,
        condicionIva: data.condicionIva
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
        error: (err) => {
            this.saving.set(false);
            console.error('Error updating profile', err);
            Swal.fire('Error', 'No se pudieron guardar los cambios', 'error');
        }
    });
  }

  // --- INTEGRATIONS ---

  saveIntegrations() {
      this.notificationService.updateAlertSettings(this.configDays, this.configHours, this.configWhatsapp, this.configWhatsappNumber);
      Swal.fire({
          icon: 'success',
          title: 'Configuración Guardada',
          timer: 1500,
          showConfirmButton: false
      });

      if (this.configWhatsapp && !this.qrCodeUrl && !this.qrPollInterval) {
          this.startQrPolling();
      }
  }

  startQrPolling() {
      this.stopQrPolling();
      this.qrPollInterval = setInterval(() => {
          this.notificationService.getWhatsappStatus().subscribe({
            next: (status: any) => {
              if (status.qr) {
                  this.qrCodeUrl = status.qr;
              } else if (status.ready) {
                  this.qrCodeUrl = null;
                  this.stopQrPolling();
                  
                  if (status.number && !this.configWhatsappNumber) {
                      this.configWhatsappNumber = status.number;
                  }

                  Swal.fire({
                    title: '¡Conectado!',
                    text: status.number ? `Vinculado con ${status.number}` : 'El bot de WhatsApp está listo.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                  });
              }
            },
            error: (err) => console.warn('Polling error:', err)
          });
      }, 3000);
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
                      this.qrCodeUrl = null;
                      this.configWhatsappNumber = '';
                      // Update settings to clear the number
                      this.notificationService.updateAlertSettings(this.configDays, this.configHours, this.configWhatsapp, '');
                      
                      if (this.configWhatsapp) this.startQrPolling();
                  },
                  error: () => Swal.fire('Error', 'No se pudo cerrar la sesión.', 'error')
              });
          }
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
