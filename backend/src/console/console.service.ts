import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../users/entities/subscription.entity';
import { Client } from '../clients/client.entity';
import { Expediente } from '../expedientes/expediente.entity';
import { ConsoleSummary, ConsoleTenant, ConsoleTenantStatus } from './console.contract';

/** Precios mensuales vigentes (ver MercadopagoController.createSubscription). */
export const PLAN_PRICES_ARS: Record<string, number> = { basic: 20000, pro: 35000 };
/** Mismo período de gracia que el frontend (SubscriptionService). */
export const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/** Traduce el estado propio de Themis al estado común de la consola. */
export function deriveTenantStatus(
  isActive: boolean,
  subscription: Pick<Subscription, 'subscriptionStatus' | 'subscriptionExpiresAt'> | null | undefined,
  now: Date = new Date(),
): ConsoleTenantStatus {
  if (!isActive) return 'suspended';
  const status = subscription?.subscriptionStatus ?? 'trial';
  if (status === 'paused' || status === 'cancelled') return status;

  const expiresAt = subscription?.subscriptionExpiresAt ? new Date(subscription.subscriptionExpiresAt) : null;
  if (expiresAt && expiresAt.getTime() < now.getTime()) {
    return now.getTime() - expiresAt.getTime() <= GRACE_PERIOD_MS ? 'grace' : 'expired';
  }
  return status === 'active' ? 'active' : 'trial';
}

@Injectable()
export class ConsoleService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(Expediente) private readonly expedientes: Repository<Expediente>,
  ) {}

  async summary(): Promise<ConsoleSummary> {
    // Sólo estudios (role USER): los ADMIN son del equipo, no clientes.
    const users = await this.users.find({ where: { role: 'USER' }, order: { createdAt: 'DESC' } });
    const subs = await this.subscriptions.find();
    const subByUser = new Map(subs.map((s) => [s.userId, s]));

    const [clientCounts, expedienteCounts] = await Promise.all([
      this.countByUser(this.clients),
      this.countByUser(this.expedientes),
    ]);

    const now = new Date();
    const tenants: ConsoleTenant[] = users.map((u: any) => {
      const sub = subByUser.get(u.id);
      const status = deriveTenantStatus(u.isActive, sub, now);
      const plan = sub?.subscriptionPlan ?? 'pro';
      return {
        id: u.id,
        name: u.fullName || u.email,
        email: u.email ?? null,
        plan,
        status,
        monthlyAmount: status === 'active' ? PLAN_PRICES_ARS[plan] ?? 0 : 0,
        expiresAt: sub?.subscriptionExpiresAt ? new Date(sub.subscriptionExpiresAt).toISOString() : null,
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
        usage: {
          clientes: clientCounts.get(u.id) ?? 0,
          expedientes: expedienteCounts.get(u.id) ?? 0,
        },
      };
    });

    return {
      product: 'legal-tech',
      displayName: 'Themis',
      sector: 'Estudios jurídicos',
      currency: 'ARS',
      generatedAt: now.toISOString(),
      tenants,
    };
  }

  /** Suspender = el estudio no puede iniciar sesión. Sus datos quedan intactos. */
  async setSuspended(tenantId: string, suspended: boolean): Promise<{ id: string; status: ConsoleTenantStatus }> {
    const result = await this.users.update({ id: tenantId, role: 'USER' } as any, { isActive: !suspended } as any);
    if (!result.affected) throw new NotFoundException('Estudio no encontrado');
    const user: any = await this.users.findOne({ where: { id: tenantId } });
    const sub = await this.subscriptions.findOne({ where: { userId: tenantId } });
    return { id: tenantId, status: deriveTenantStatus(user.isActive, sub) };
  }

  private async countByUser(repo: Repository<any>): Promise<Map<string, number>> {
    const rows: { userId: string; total: string }[] = await repo
      .createQueryBuilder('e')
      .select('e.userId', 'userId')
      .addSelect('COUNT(*)', 'total')
      .groupBy('e.userId')
      .getRawMany();
    return new Map(rows.map((r) => [r.userId, Number(r.total)]));
  }
}
