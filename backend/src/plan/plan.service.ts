import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Subscription } from '../users/entities/subscription.entity';
import { computeAccess, LimitedResource, PlanAccess } from './plan-policy';

const TABLE_BY_RESOURCE: Record<LimitedResource, string> = { clientes: 'client', expedientes: 'expediente' };

@Injectable()
export class PlanService {
  constructor(private readonly dataSource: DataSource) {}

  async accessFor(userId: string, isAdmin: boolean): Promise<PlanAccess> {
    const sub = await this.dataSource.getRepository(Subscription).findOne({ where: { userId } });
    return computeAccess(sub, isAdmin);
  }

  async usage(userId: string): Promise<Record<LimitedResource, number>> {
    const entries = await Promise.all(
      (Object.keys(TABLE_BY_RESOURCE) as LimitedResource[]).map(async (r) => [r, await this.count(userId, r)] as const),
    );
    return Object.fromEntries(entries) as Record<LimitedResource, number>;
  }

  count(userId: string, resource: LimitedResource): Promise<number> {
    return this.dataSource
      .query(`SELECT COUNT(*)::int AS total FROM "${TABLE_BY_RESOURCE[resource]}" WHERE "userId" = $1`, [userId])
      .then((rows) => rows[0]?.total ?? 0);
  }
}
