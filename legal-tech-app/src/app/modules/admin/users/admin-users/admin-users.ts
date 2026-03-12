import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { UsersService, User } from '../../../../core/services/users';
import { UserForm } from '../user-form/user-form';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, DialogModule, ToastModule, UserForm, TooltipModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css',
  providers: [MessageService]
})
export class AdminUsers implements OnInit {
  users: User[] = [];
  displayCreateDialog: boolean = false;
  selectedUser: User | null = null;
  headerText: string = 'Crear Nuevo Usuario';

  constructor(
    private usersService: UsersService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.usersService.getUsers().subscribe({
      next: (data) => this.users = data,
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
    if (confirm(`¿Estás seguro de eliminar a ${user.fullName}? esta acción no se puede deshacer.`)) {
        this.usersService.deleteUser(user.id).subscribe({
            next: () => {
                this.messageService.add({severity:'success', summary:'Eliminado', detail:'Usuario eliminado permanentemente'});
                this.loadUsers();
            },
            error: () => this.messageService.add({severity:'error', summary:'Error', detail:'No se pudo eliminar el usuario'})
        });
    }
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
        const index = this.users.findIndex(u => u.id === updatedUser.id);
        if (index !== -1) {
            this.users[index] = updatedUser;
        }
        const msg = updatedUser.isActive ? 'Usuario Activado' : 'Usuario Suspendido';
        this.messageService.add({severity:'info', summary:'Estado Actualizado', detail: msg});
      },
      error: (err) => this.messageService.add({severity:'error', summary:'Error', detail:'Falló al actualizar estado'})
    });
  }

  getSeverity(isActive: boolean): any {
      return isActive ? 'warning' : 'success';
  }

  getActiveSubscriptionsCount(): number {
    return this.users.filter(u => u.subscriptionStatus === 'active').length;
  }

  getCancelledCount(): number {
    return this.users.filter(u => u.subscriptionStatus === 'cancelled').length;
  }
}
