import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { DashboardService } from '../../core/services/dashboard.service';
import { AuditService } from '../../core/services/audit.service';
import { DeadlineService } from '../../core/services/deadline.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  
  dashboardService = inject(DashboardService);
  auditService = inject(AuditService);
  deadlineService = inject(DeadlineService); // Inject DeadlineService

  stats = signal<any>(null);
  recentActivity = this.auditService.recentLogs;
  deadlines = this.deadlineService.deadlines; // Get deadlines signal

  currentDate = new Date();

  // Computed: Top 5 upcoming deadlines
  upcomingDeadlines = computed(() => {
     const now = new Date();
     now.setHours(0,0,0,0);
     
     return this.deadlines()
        .filter(d => d.estado === 'PENDIENTE')
        .filter(d => {
            const date = new Date(d.fechaVencimiento);
            date.setHours(0,0,0,0);
            return date >= now;
        })
        .sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime())
        .slice(0, 5);
  });

  // Computed: Current Month Balance
  currentMonthBalance = computed(() => {
      const financials = this.stats()?.financials;
      if (!financials || financials.length === 0) return 0;
      // Assuming the last entry is the current/latest month
      const current = financials[financials.length - 1];
      return current.income - current.expense;
  });

  ngOnInit(): void {
    this.loadStats();
    this.auditService.loadRecentLogs();
  }

  loadStats() {
    this.dashboardService.getStats().subscribe({
        next: (data) => this.stats.set(data),
        error: (err) => console.error('Error loading stats', err)
    });
  }

  // Helper to calculate max value for chart scaling
  get maxFinancial() {
      const financials = this.stats()?.financials || [];
      if (financials.length === 0) return 100;
      return Math.max(...financials.map((f: any) => Math.max(f.income, f.expense))) * 1.1; // +10% padding
  }

  getBarHeight(value: number): string {
      const max = this.maxFinancial;
      const percentage = (value / max) * 100;
      // Ensure at least 4px height for visibility
      return `${Math.max(percentage, 2)}%`;
  }

  // Helper for deadline days remaining
  getDaysRemaining(dateStr: Date): number {
      const date = new Date(dateStr);
      const now = new Date();
      now.setHours(0,0,0,0);
      date.setHours(0,0,0,0);
      
      const diffTime = date.getTime() - now.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getDeadlineColor(days: number): string {
      if (days <= 2) return 'text-red-600 bg-red-50 border-red-100';
      if (days <= 7) return 'text-orange-600 bg-orange-50 border-orange-100';
      return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  }
}
