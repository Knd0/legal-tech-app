import { Component, OnInit, signal, inject, computed, effect } from '@angular/core';
import { NotificationService } from './core/services/notification.service';
import { DeadlineService } from './core/services/deadline.service';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { PwaUpdateService } from './core/services/pwa-update.service';
import { LoadingService } from './core/services/loading.service';
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
  isMobileMenuOpen = signal(false);
  bannerDismissed = signal(false);

  toggleMobileMenu() {
    this.isMobileMenuOpen.update(v => !v);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }

  dismissBanner() {
    this.bannerDismissed.set(true);
  }

  deadlineService = inject(DeadlineService);
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  
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
    private pwaUpdateService: PwaUpdateService,
    public loadingService: LoadingService
  ) {
    // Listen for the PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      this.deferredPrompt = e;
      // Update UI notify the user they can install the PWA
      this.showInstallButton.set(true);
    });
  }

  deferredPrompt: any;
  showInstallButton = signal(false);

  async installApp() {
    if (!this.deferredPrompt) {
      return;
    }
    // Show the install prompt
    this.deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await this.deferredPrompt.userChoice;
    // We've used the prompt, and can't use it again, throw it away
    this.deferredPrompt = null;
    this.showInstallButton.set(false);
  }

  ngOnInit() {
    console.log('LegalTech App Initialized successfully');
    this.items = [
        {
            label: 'Inicio',
            icon: 'pi pi-home',
            routerLink: '/dashboard'
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

    ];
  }

  requestNotifications() {
    this.notificationService.subscribeToNotifications();
  }
}
