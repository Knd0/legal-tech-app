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

  findAll(userId: string) {
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
