import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalModel } from './legal-model.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class LegalModelsService {
  constructor(
    @InjectRepository(LegalModel)
    private readonly legalModelRepository: Repository<LegalModel>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(data: Partial<LegalModel>, userId: string): Promise<LegalModel> {
    const model = this.legalModelRepository.create({ ...data, userId });
    const saved = await this.legalModelRepository.save(model);
    void this.auditLogsService
      .log(userId, 'CREATE', 'LEGAL_MODEL', saved.id, `Creado modelo: ${saved.titulo}`)
      .catch((err) => console.error('Audit log failed:', err));
    return saved;
  }

  async findAll(
    userId: string,
    query?: string,
    fuero?: string,
    tipoEscrito?: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: LegalModel[]; total: number }> {
    const qb = this.legalModelRepository.createQueryBuilder('lm');
    qb.where('lm.userId = :userId', { userId });

    if (query) {
      qb.andWhere(
        '(lm.titulo ILIKE :q OR lm.contenido ILIKE :q OR lm.tags ILIKE :q)',
        { q: `%${query}%` },
      );
    }

    if (fuero) {
      qb.andWhere('lm.fuero = :fuero', { fuero });
    }

    if (tipoEscrito) {
      qb.andWhere('lm.tipoEscrito = :tipoEscrito', { tipoEscrito });
    }

    qb.orderBy('lm.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOne(id: string, userId: string): Promise<LegalModel> {
    const model = await this.legalModelRepository.findOne({ where: { id, userId } });
    if (!model) {
      throw new NotFoundException('Modelo de escrito no encontrado');
    }
    return model;
  }

  async update(id: string, data: Partial<LegalModel>, userId: string): Promise<LegalModel> {
    const model = await this.findOne(id, userId);
    Object.assign(model, data);
    const saved = await this.legalModelRepository.save(model);
    void this.auditLogsService
      .log(userId, 'UPDATE', 'LEGAL_MODEL', saved.id, `Actualizado modelo: ${saved.titulo}`)
      .catch((err) => console.error('Audit log failed:', err));
    return saved;
  }

  async remove(id: string, userId: string): Promise<void> {
    const model = await this.findOne(id, userId);
    await this.legalModelRepository.remove(model);
    void this.auditLogsService
      .log(userId, 'DELETE', 'LEGAL_MODEL', id, `Eliminado modelo: ${model.titulo}`)
      .catch((err) => console.error('Audit log failed:', err));
  }
}
