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

  async findAll(
    userId: string,
    page?: number,
    limit?: number,
    search?: string,
    estado?: string,
  ): Promise<any> {
    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      const take = limit;

      const queryBuilder = this.expedientesRepository.createQueryBuilder('expediente')
        .where('expediente.userId = :userId', { userId })
        .leftJoinAndSelect('expediente.cliente', 'cliente');

      if (estado) {
        queryBuilder.andWhere('expediente.estado = :estado', { estado });
      }

      if (search) {
        queryBuilder.andWhere(
          '(LOWER(expediente.nroExpediente) LIKE :search OR LOWER(expediente.caratula) LIKE :search OR LOWER(expediente.fuero) LIKE :search OR LOWER(expediente.juzgado) LIKE :search)',
          { search: `%${search.toLowerCase()}%` }
        );
      }

      const [data, total] = await queryBuilder
        .orderBy('expediente.fechaInicio', 'DESC')
        .skip(skip)
        .take(take)
        .getManyAndCount();

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const where: any = { userId };
    if (estado) where.estado = estado;

    return this.expedientesRepository.find({
      where,
      relations: ['cliente'],
      order: { fechaInicio: 'DESC' }
    });
  }

  async findOne(id: string, userId: string): Promise<Expediente | null> {
    return this.expedientesRepository.findOne({ where: { id, userId }, relations: ['cliente'] });
  }

  async create(expediente: Partial<Expediente>, userId: string): Promise<Expediente> {
    const newExpediente = this.expedientesRepository.create({ ...expediente, userId });
    const savedExpediente = await this.expedientesRepository.save(newExpediente);
    void this.auditLogsService.log(userId, 'CREATE', 'EXPEDIENTE', savedExpediente.id, `Created expediente ${savedExpediente.caratula}`).catch(err => console.error('Audit log failed:', err));
    return savedExpediente;
  }

  async update(id: string, expediente: Partial<Expediente>, userId: string): Promise<void> {
    await this.expedientesRepository.update({ id, userId }, expediente);
    void this.auditLogsService.log(userId, 'UPDATE', 'EXPEDIENTE', id, `Updated expediente`).catch(err => console.error('Audit log failed:', err));
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.expedientesRepository.delete({ id, userId });
    void this.auditLogsService.log(userId, 'DELETE', 'EXPEDIENTE', id, `Deleted expediente`).catch(err => console.error('Audit log failed:', err));
  }
}
