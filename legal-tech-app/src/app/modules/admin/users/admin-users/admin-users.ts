import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { UsersService, User } from '../../../../core/services/users';
import { UserForm } from '../user-form/user-form';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, DialogModule, ToastModule, UserForm, TooltipModule, InputTextModule, SelectModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css',
  providers: [MessageService]
})
export class AdminUsers implements OnInit {
  private usersService = inject(UsersService);
  private messageService = inject(MessageService);

  users = signal<User[]>([]);
  searchTerm = signal<string>('');
  filterStatus = signal<string>('');
  displayCreateDialog = false;
  selectedUser: User | null = null;
  headerText = 'Crear Nuevo Usuario';

  statusOptions = [
    { label: 'Todos', value: '' },
    { label: 'Trial', value: 'trial' },
    { label: 'Activo', value: 'active' },
    { label: 'Cancelado', value: 'cancelled' },
    { label: 'Pausado', value: 'paused' },
  ];

  filteredUsers = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const status = this.filterStatus();
    return this.users().filter(u => {
      const matchesSearch = !term ||
        u.fullName?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.role?.toLowerCase().includes(term);
      const matchesStatus = !status || u.subscriptionStatus === status;
      return matchesSearch && matchesStatus;
    });
  });

  activeSubscriptionsCount = computed(() =>
    this.users().filter(u => u.subscriptionStatus === 'active').length
  );

  cancelledCount = computed(() =>
    this.users().filter(u => u.subscriptionStatus === 'cancelled').length
  );

  constructor() {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.usersService.getUsers().subscribe({
      next: (data) => this.users.set(data),
      error: (err) => this.messageService.add({severity:'error', summary:'Error', detail:'Failed to load users'})
    });
  }

  openCreateDialog() {
    this.selectedUser = null;
    this.headerText = 'Crear Nuevo Usuario';
    this.displayCreateDialog = true;
  }

  editUser(user: User) {
    this.selectedUser = user;
    this.headerText = 'Editar Usuario';
    this.displayCreateDialog = true;
  }

  deleteUser(user: User) {
    Swal.fire({
      title: `¿Eliminar a ${user.fullName}?`,
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.usersService.deleteUser(user.id).subscribe({
          next: () => {
            this.messageService.add({severity:'success', summary:'Eliminado', detail:'Usuario eliminado permanentemente'});
            this.loadUsers();
          },
          error: () => this.messageService.add({severity:'error', summary:'Error', detail:'No se pudo eliminar el usuario'})
        });
      }
    });
  }

  onUserCreated() {
    this.displayCreateDialog = false;
    this.loadUsers();
    this.messageService.add({severity:'success', summary:'Creado', detail:'Usuario creado exitosamente'});
  }

  onUserUpdated() {
    this.displayCreateDialog = false;
    this.loadUsers();
    this.messageService.add({severity:'success', summary:'Actualizado', detail:'Usuario actualizado exitosamente'});
  }

  toggleSuspension(user: User) {
    this.usersService.suspendUser(user.id).subscribe({
      next: (updatedUser) => {
        this.users.update(prev => {
          const index = prev.findIndex(u => u.id === updatedUser.id);
          if (index !== -1) {
            const newUsers = [...prev];
            newUsers[index] = updatedUser;
            return newUsers;
          }
          return prev;
        });
        const msg = updatedUser.isActive ? 'Usuario Activado' : 'Usuario Suspendido';
        this.messageService.add({severity:'info', summary:'Estado Actualizado', detail: msg});
      },
      error: (err) => this.messageService.add({severity:'error', summary:'Error', detail:'Falló al actualizar estado'})
    });
  }

  getSeverity(isActive: boolean): any {
      return isActive ? 'warning' : 'success';
  }
}
