import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogsRepository: Repository<AuditLog>,
  ) {}

  async log(userId: string, action: string, entityType: string, entityId: string, details?: string) {
    const log = this.auditLogsRepository.create({
      userId,
      action,
      entityType,
      entityId,
      details,
    });
    return this.auditLogsRepository.save(log);
  }

  async findAll(userId: string, page?: number, limit?: number): Promise<any> {
    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      const take = limit;

      const [data, total] = await this.auditLogsRepository.findAndCount({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip,
        take,
      });

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    return this.auditLogsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  // Find recent logs for dashboard (limit 5)
  async findRecent(userId: string) {
    return this.auditLogsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 5,
    });
  }
}
