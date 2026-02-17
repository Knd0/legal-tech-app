import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expediente } from './expediente.entity';

import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class ExpedientesService {
  constructor(
    @InjectRepository(Expediente)
    private expedientesRepository: Repository<Expediente>,
    private auditLogsService: AuditLogsService,
  ) {}

  async findAll(userId: string): Promise<Expediente[]> {
    return this.expedientesRepository.find({ where: { userId }, relations: ['cliente'] });
  }

  async findOne(id: string, userId: string): Promise<Expediente | null> {
    return this.expedientesRepository.findOne({ where: { id, userId }, relations: ['cliente'] });
  }

  async create(expediente: Partial<Expediente>, userId: string): Promise<Expediente> {
    const newExpediente = this.expedientesRepository.create({ ...expediente, userId });
    const savedExpediente = await this.expedientesRepository.save(newExpediente);
    await this.auditLogsService.log(userId, 'CREATE', 'EXPEDIENTE', savedExpediente.id, `Created expediente ${savedExpediente.caratula}`);
    return savedExpediente;
  }

  async update(id: string, expediente: Partial<Expediente>, userId: string): Promise<void> {
    await this.expedientesRepository.update({ id, userId }, expediente);
    await this.auditLogsService.log(userId, 'UPDATE', 'EXPEDIENTE', id, `Updated expediente`);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.expedientesRepository.delete({ id, userId });
    await this.auditLogsService.log(userId, 'DELETE', 'EXPEDIENTE', id, `Deleted expediente`);
  }
}
