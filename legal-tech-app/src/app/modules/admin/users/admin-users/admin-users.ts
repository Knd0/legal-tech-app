import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
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
  totalRecords = signal<number>(0);
  pageSize = 10;
  loading = signal<boolean>(false);

  searchTerm = signal<string>('');
  filterStatus = signal<string>('');

  private currentPage = 1;
  private searchDebounce: any;

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

  activeSubscriptionsCount = computed(() =>
    this.users().filter(u => u.subscriptionStatus === 'active').length
  );

  cancelledCount = computed(() =>
    this.users().filter(u => u.subscriptionStatus === 'cancelled').length
  );

  ngOnInit() {
    this.loadPage(1);
  }

  loadPage(page: number) {
    this.loading.set(true);
    this.currentPage = page;
    this.usersService.getUsersPaginated(page, this.pageSize, this.searchTerm() || undefined, this.filterStatus() || undefined).subscribe({
      next: (res) => {
        this.users.set(res.data);
        this.totalRecords.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los usuarios' });
      }
    });
  }

  onLazyLoad(event: TableLazyLoadEvent) {
    const page = Math.floor((event.first ?? 0) / (event.rows ?? this.pageSize)) + 1;
    this.loadPage(page);
  }

  onSearchChange(value: string) {
    this.searchTerm.set(value);
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.loadPage(1), 400);
  }

  onStatusChange(value: string) {
    this.filterStatus.set(value);
    this.loadPage(1);
  }

  exportCsv() {
    this.usersService.getUsers().subscribe({
      next: (allUsers) => {
        const headers = ['Nombre', 'Email', 'Teléfono', 'Rol', 'Estado', 'Suscripción', 'Vencimiento', 'Creado'];
        const rows = allUsers.map(u => [
          u.fullName ?? '',
          u.email ?? '',
          u.phoneNumber ?? '',
          u.role ?? '',
          u.isActive ? 'ACTIVO' : 'SUSPENDIDO',
          u.subscriptionStatus ?? '',
          u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).toLocaleDateString('es-AR') : '',
          u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-AR') : '',
        ]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo exportar el CSV' })
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
            this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Usuario eliminado permanentemente' });
            this.loadPage(this.currentPage);
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el usuario' })
        });
      }
    });
  }

  onUserCreated() {
    this.displayCreateDialog = false;
    this.loadPage(1);
    this.messageService.add({ severity: 'success', summary: 'Creado', detail: 'Usuario creado exitosamente' });
  }

  onUserUpdated() {
    this.displayCreateDialog = false;
    this.loadPage(this.currentPage);
    this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: 'Usuario actualizado exitosamente' });
  }

  toggleSuspension(user: User) {
    this.usersService.suspendUser(user.id).subscribe({
      next: (updatedUser) => {
        this.users.update(prev => {
          const index = prev.findIndex(u => u.id === updatedUser.id);
          if (index !== -1) {
            const next = [...prev];
            next[index] = updatedUser;
            return next;
          }
          return prev;
        });
        const msg = updatedUser.isActive ? 'Usuario Activado' : 'Usuario Suspendido';
        this.messageService.add({ severity: 'info', summary: 'Estado Actualizado', detail: msg });
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Falló al actualizar estado' })
    });
  }

  getSeverity(isActive: boolean): any {
    return isActive ? 'warning' : 'success';
  }
}
