import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import Swal from 'sweetalert2';
import { environment } from '../../../../../environments/environment';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const pass = control.get('newPassword')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return pass && confirm && pass !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, InputTextModule, ButtonModule, InputGroupModule, InputGroupAddonModule],
  templateUrl: './forgot-password.html',
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);

  step = signal<1 | 2>(1);
  loading = signal(false);
  email = signal('');
  channel = signal<'whatsapp' | 'email'>('whatsapp');

  emailForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  resetForm: FormGroup = this.fb.group({
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Z])(?=.*\d).{8,}$/)]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordMatchValidator });

  requestOtp() {
    if (this.emailForm.invalid) { this.emailForm.markAllAsTouched(); return; }
    this.loading.set(true);
    const email = this.emailForm.value.email;
    this.http.post<{ message: string; channel: 'whatsapp' | 'email' }>(`${environment.apiUrl}/auth/forgot-password`, { email }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.email.set(email);
        this.channel.set(res.channel);
        this.step.set(2);
      },
      error: (err) => {
        this.loading.set(false);
        Swal.fire('Error', err.error?.message || 'No se pudo enviar el código.', 'error');
      }
    });
  }

  resetPassword() {
    if (this.resetForm.invalid) { this.resetForm.markAllAsTouched(); return; }
    this.loading.set(true);
    const { otp, newPassword } = this.resetForm.value;
    this.http.post(`${environment.apiUrl}/auth/reset-password`, { email: this.email(), otp, newPassword }).subscribe({
      next: () => {
        this.loading.set(false);
        Swal.fire({
          icon: 'success',
          title: '¡Contraseña actualizada!',
          text: 'Ya podés iniciar sesión con tu nueva contraseña.',
          confirmButtonText: 'Ir al login',
        }).then(() => this.router.navigate(['/auth/login']));
      },
      error: (err) => {
        this.loading.set(false);
        Swal.fire('Error', err.error?.message || 'Código incorrecto o expirado.', 'error');
      }
    });
  }
}
