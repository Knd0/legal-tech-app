import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { AuthService } from '../../../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    RouterModule,
    InputTextModule,
    InputGroupModule,
    InputGroupAddonModule
  ],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  fb = inject(FormBuilder);
  authService = inject(AuthService);
  router = inject(Router);

  registerForm: FormGroup;
  loading = signal<boolean>(false);

  constructor() {
    this.registerForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { fullName, email, phoneNumber, password, confirmPassword } = this.registerForm.getRawValue();

    if (password !== confirmPassword) {
      Swal.fire('Error', 'Las contraseñas no coinciden', 'error');
      return;
    }

    this.loading.set(true);

    this.authService.register(email, password, fullName, phoneNumber).subscribe({
      next: () => {
        this.loading.set(false);
        Swal.fire({
          icon: 'success',
          title: 'Registro Exitoso',
          text: 'Tu cuenta ha sido creada. Inicia sesión para continuar.',
          timer: 3000,
          showConfirmButton: false
        }).then(() => {
          this.router.navigate(['/auth/login']);
        });
      },
      error: (err: any) => {
        this.loading.set(false);
        console.error('Registration error', err);
        Swal.fire('Error', 'No se pudo crear la cuenta. Verifica que el correo no esté en uso.', 'error');
      }
    });
  }
}
