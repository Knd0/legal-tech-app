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
    this.displayCreateDialog = true;
  }

  onUserCreated() {
    this.displayCreateDialog = false;
    this.loadUsers();
    this.messageService.add({severity:'success', summary:'Success', detail:'User created'});
  }

  toggleSuspension(user: User) {
    this.usersService.suspendUser(user.id).subscribe({
      next: (updatedUser) => {
        const index = this.users.findIndex(u => u.id === updatedUser.id);
        if (index !== -1) {
            this.users[index] = updatedUser;
        }
        const msg = updatedUser.isActive ? 'User Activated' : 'User Suspended';
        this.messageService.add({severity:'info', summary:'Status Updated', detail: msg});
      },
      error: (err) => this.messageService.add({severity:'error', summary:'Error', detail:'Failed to update status'})
    });
  }
}
