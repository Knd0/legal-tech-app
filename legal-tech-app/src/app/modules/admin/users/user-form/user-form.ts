import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { UsersService } from '../../../../core/services/users';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule, SelectModule],
  templateUrl: './user-form.html',
  styleUrl: './user-form.css',
})
export class UserForm {
  @Output() userCreated = new EventEmitter<void>();
  userForm: FormGroup;
  loading: boolean = false;
  roles = [
    { label: 'Administrador', value: 'ADMIN' },
    { label: 'Usuario (Abogado)', value: 'USER' }
  ];

  constructor(
    private fb: FormBuilder,
    private usersService: UsersService
  ) {
    this.userForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['USER', Validators.required]
    });
  }

  onSubmit() {
    if (this.userForm.valid) {
      this.loading = true;
      this.usersService.createUser(this.userForm.value).subscribe({
        next: () => {
          this.loading = false;
          this.userForm.reset({ role: 'USER' });
          this.userCreated.emit();
        },
        error: () => {
          this.loading = false;
          // Error handled by parent toast or global interceptor
        }
      });
    } else {
        this.userForm.markAllAsTouched();
    }
  }
}
