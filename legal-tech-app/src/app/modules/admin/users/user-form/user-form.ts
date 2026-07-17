import { Component, EventEmitter, Output, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { UsersService, User } from '../../../../core/services/users';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule, SelectModule],
  templateUrl: './user-form.html',
  providers: [] // Removed UserForm from imports array to avoid circular dependency if any
})
export class UserForm implements OnChanges {
  @Input() userToEdit: User | null = null;
  @Output() userCreated = new EventEmitter<void>();
  @Output() userUpdated = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  
  userForm: FormGroup;
  loading: boolean = false;
  roles = [
    { label: 'Administrador', value: 'ADMIN' },
    { label: 'Usuario (Abogado)', value: 'USER' }
  ];
  subscriptionStatuses = [
    { label: 'Prueba (Trial)', value: 'trial' },
    { label: 'Activo (Pago)', value: 'active' },
    { label: 'Pausado', value: 'paused' },
    { label: 'Cancelado', value: 'cancelled' }
  ];

  constructor(
    private fb: FormBuilder,
    private usersService: UsersService
  ) {
    this.userForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['USER', Validators.required],
      subscriptionStatus: ['trial'],
      subscriptionExpiresAt: [null]
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['userToEdit']) {
      if (this.userToEdit) {
        // Edit Mode
        this.userForm.patchValue({
          fullName: this.userToEdit.fullName,
          email: this.userToEdit.email,
          role: this.userToEdit.role,
          subscriptionStatus: this.userToEdit.subscriptionStatus || 'trial',
          subscriptionExpiresAt: this.userToEdit.subscriptionExpiresAt ? new Date(this.userToEdit.subscriptionExpiresAt).toISOString().split('T')[0] : null,
          password: '' // Don't fill password
        });
        // Remove password required validator
        this.userForm.get('password')?.clearValidators();
        this.userForm.get('password')?.addValidators([Validators.minLength(6)]); // Keep min length if typed
        this.userForm.get('password')?.updateValueAndValidity();
      } else {
        // Create Mode
        this.userForm.reset({ role: 'USER', subscriptionStatus: 'trial' });
        this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
        this.userForm.get('password')?.updateValueAndValidity();
      }
    }
  }

  onSubmit() {
    if (this.userForm.valid) {
      this.loading = true;
      const formData = { ...this.userForm.value };

      // Ensure empty date is passed as null
      if (formData.subscriptionExpiresAt === '') {
          formData.subscriptionExpiresAt = null;
      }

      // Remove empty password if editing
      if (this.userToEdit && !formData.password) {
          delete formData.password;
      }

      if (this.userToEdit) {
        this.usersService.updateUser(this.userToEdit.id, formData).subscribe({
            next: () => {
                this.loading = false;
                this.userUpdated.emit();
            },
            error: () => this.loading = false
        });
      } else {
        this.usersService.createUser(formData).subscribe({
            next: () => {
                this.loading = false;
                this.userForm.reset({ role: 'USER' });
                this.userCreated.emit();
            },
            error: () => this.loading = false
        });
      }
    } else {
        this.userForm.markAllAsTouched();
    }
  }

  onCancel() {
    this.userForm.reset({ role: 'USER', subscriptionStatus: 'trial' });
    this.cancel.emit();
  }
}
