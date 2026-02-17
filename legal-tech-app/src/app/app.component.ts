import { Component, OnInit, signal, inject, computed, effect } from '@angular/core';
import { NotificationService } from './core/services/notification.service';
import { DeadlineService } from './core/services/deadline.service';
import { AuthService } from './core/services/auth.service';
import { PwaUpdateService } from './core/services/pwa-update.service';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  protected readonly title = signal('legal-tech-app');
  items: MenuItem[] | undefined;

  deadlineService = inject(DeadlineService);
  authService = inject(AuthService);
  
  // Calculate distinct urgent deadlines (< 3 days)
  notificationCount = computed(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    return this.deadlineService.deadlines().filter(d => {
       const date = new Date(d.fechaVencimiento);
       date.setHours(0,0,0,0);
       const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
       return diff <= 3 && diff >= 0 && d.estado !== 'CUMPLIDO';
    }).length;
  });

  constructor(
    public notificationService: NotificationService,
    private pwaUpdateService: PwaUpdateService // Injected to initialize logic
  ) {}

  ngOnInit() {
    this.items = [
        {
            label: 'Inicio',
            icon: 'pi pi-home',
            routerLink: '/'
        },
        {
            label: 'Clientes',
            icon: 'pi pi-users',
            routerLink: '/clientes'
        },
        {
            label: 'Expedientes',
            icon: 'pi pi-briefcase',
            routerLink: '/expedientes'
        },
        {
            label: 'Calendario',
            icon: 'pi pi-calendar',
            routerLink: '/calendario'
        },
        {
          label: 'Notificaciones',
          icon: 'pi pi-bell',
          badge: this.notificationCount().toString(),
          badgeStyleClass: this.notificationCount() > 0 ? 'bg-red-500 text-white' : 'hidden', 
          command: () => this.requestNotifications()
        }
    ];
  }

  requestNotifications() {
    this.notificationService.subscribeToNotifications();
  }
}
