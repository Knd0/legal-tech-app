import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export type LimitedResource = 'clientes' | 'expedientes';
export type Feature = 'ai' | 'afip' | 'whatsapp';

export interface PlanInfo {
  plan: 'basic' | 'pro';
  planName: string;
  effectivePlan: 'basic' | 'pro';
  state: 'trial' | 'active' | 'grace' | 'expired' | 'inactive';
  canWrite: boolean;
  expiresAt: string | null;
  graceEndsAt: string | null;
  daysLeft: number | null;
  limits: Record<LimitedResource, number | null>;
  features: Record<Feature, boolean>;
  usage: Record<LimitedResource, number>;
}

/**
 * Plan, límites y uso del estudio, tal como los calcula el servidor (GET /plan).
 * Reemplaza los chequeos que contaban los elementos de la página cargada: con
 * paginación, "clients().length" no era el total real.
 */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  readonly info = signal<PlanInfo | null>(null);

  readonly isTrial = computed(() => this.info()?.state === 'trial');
  readonly isGrace = computed(() => this.info()?.state === 'grace');

  /** Etiqueta corta para la barra superior, debajo del nombre del usuario. */
  readonly etiqueta = computed(() => {
    if (this.auth.currentUser()?.role === 'ADMIN') return 'Administrador';
    const info = this.info();
    if (!info) return '';
    const sufijo: Record<PlanInfo['state'], string> = {
      trial: ' · prueba gratis',
      active: '',
      grace: ' · vencido',
      expired: ' · vencido',
      inactive: ' · sin suscripción',
    };
    return `Plan ${info.planName}${sufijo[info.state]}`;
  });

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) this.refresh();
      else this.info.set(null);
    });
  }

  refresh(): void {
    this.http.get<PlanInfo>(`${environment.apiUrl}/plan`, { headers: { 'X-Skip-Loader': '1' } }).subscribe({
      next: (info) => this.info.set(info),
      error: () => this.info.set(null),
    });
  }

  hasFeature(feature: Feature): boolean {
    const info = this.info();
    if (this.auth.currentUser()?.role === 'ADMIN') return true;
    return info ? info.features[feature] : true; // mientras carga no bloqueamos: el servidor decide igual
  }

  isAtLimit(resource: LimitedResource): boolean {
    const info = this.info();
    const max = info?.limits[resource];
    return !!info && max !== null && max !== undefined && info.usage[resource] >= max;
  }

  limitMessage(resource: LimitedResource): string {
    const info = this.info();
    if (!info || !this.isAtLimit(resource)) return '';
    return `Llegaste al límite de ${info.limits[resource]} ${resource} del Plan ${info.planName}. Pasate al Plan Profesional para cargar más.`;
  }
}
