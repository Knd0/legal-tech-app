import { Component, inject, signal, OnInit, computed, effect } from '@angular/core';
import { DashboardService } from '../../core/services/dashboard.service';
import { AuditService } from '../../core/services/audit.service';
import { DeadlineService } from '../../core/services/deadline.service';
import { AuthService } from '../../core/services/auth.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { ThemeService } from '../../core/services/theme.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { ChartModule } from 'primeng/chart';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, TooltipModule, ChartModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {

  dashboardService = inject(DashboardService);
  auditService = inject(AuditService);
  deadlineService = inject(DeadlineService);
  authService = inject(AuthService);
  subscriptionService = inject(SubscriptionService);
  themeService = inject(ThemeService);

  stats = signal<any>(null);
  recentActivity = this.auditService.recentLogs;
  deadlines = this.deadlineService.deadlines;
  currentDate = new Date();

  chartData: any = null;
  chartOptions: any = null;

  private buildChartOptions(dark: boolean): any {
    const textColor = dark ? '#cbd5e1' : '#475569';
    const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, padding: 20, color: textColor }
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => ` $${ctx.parsed.y.toLocaleString('es-AR')}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: textColor }
        },
        y: {
          border: { display: false },
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            callback: (v: number) => `$${(v / 1000).toFixed(0)}k`
          }
        }
      }
    };
  }

  constructor() {
    effect(() => {
      this.chartOptions = this.buildChartOptions(this.themeService.darkMode());
    });

    effect(() => {
      const financials = this.stats()?.financials;
      if (!financials?.length) return;
      this.chartData = {
        labels: financials.map((f: any) => f.month),
        datasets: [
          {
            label: 'Ingresos',
            data: financials.map((f: any) => f.income),
            backgroundColor: 'rgba(34,197,94,0.8)',
            borderColor: 'rgba(34,197,94,1)',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Egresos',
            data: financials.map((f: any) => f.expense),
            backgroundColor: 'rgba(248,113,113,0.8)',
            borderColor: 'rgba(248,113,113,1)',
            borderWidth: 1,
            borderRadius: 4,
          }
        ]
      };
    });
  }

  upcomingDeadlines = computed(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return this.deadlines()
      .filter(d => d.estado === 'PENDIENTE')
      .filter(d => {
        const date = new Date(d.fechaVencimiento);
        date.setHours(0, 0, 0, 0);
        return date >= now;
      })
      .sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime())
      .slice(0, 5);
  });

  currentMonthBalance = computed(() => {
    const financials = this.stats()?.financials;
    if (!financials?.length) return 0;
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

  getDaysRemaining(dateStr: Date): number {
    const date = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  getDeadlineColor(days: number): string {
    if (days <= 2) return 'text-red-600 bg-red-50 border-red-100';
    if (days <= 7) return 'text-orange-600 bg-orange-50 border-orange-100';
    return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  }
}
