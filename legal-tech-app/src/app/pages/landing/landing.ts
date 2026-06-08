import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  authService = inject(AuthService);
  
  activePreviewTab = signal<'dashboard' | 'kanban' | 'copilot' | 'afip' | 'whatsapp'>('dashboard');
  billingCycle = signal<'monthly' | 'yearly'>('monthly');

  setPreviewTab(tab: 'dashboard' | 'kanban' | 'copilot' | 'afip' | 'whatsapp') {
    this.activePreviewTab.set(tab);
  }

  toggleBillingCycle() {
    this.billingCycle.update(c => c === 'monthly' ? 'yearly' : 'monthly');
  }
}

