import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movimiento } from './entities/movimiento.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class MovimientosService {
  constructor(
    @InjectRepository(Movimiento)
    private movimientosRepository: Repository<Movimiento>,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(createMovimientoDto: Partial<Movimiento>, userId: string) {
    const movimiento = this.movimientosRepository.create({ ...createMovimientoDto, userId });
    const saved = await this.movimientosRepository.save(movimiento);
    void this.auditLogsService.log(userId, 'CREATE', 'MOVIMIENTO', saved.id, `Created ${saved.tipo} of $${saved.monto}`).catch(err => console.error('Audit log failed:', err));
    return saved;
  }

  async findAllByClient(clientId: string, userId: string, page = 1, limit = 10) {
    const [data, total] = await this.movimientosRepository.findAndCount({
      where: { clientId, userId },
      order: { fecha: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async getBalance(clientId: string, userId: string) {
    const result = await this.movimientosRepository
      .createQueryBuilder('m')
      .select('m.tipo', 'tipo')
      .addSelect('SUM(m.monto)', 'sum')
      .where('m.clientId = :clientId AND m.userId = :userId', { clientId, userId })
      .groupBy('m.tipo')
      .getRawMany();
      
    let totalHonorarios = 0;
    let totalGastos = 0;
    let totalPagos = 0;

    result.forEach(row => {
      const sum = Number(row.sum || 0);
      if (row.tipo === 'HONORARIO' || row.tipo === 'REGULADO' || row.tipo === 'CONVENIO') {
        totalHonorarios += sum;
      } else if (row.tipo === 'GASTO') {
        totalGastos += sum;
      } else if (row.tipo === 'PAGO') {
        totalPagos += sum;
      }
    });

    const totalDeuda = totalHonorarios + totalGastos;
    const balance = totalPagos - totalDeuda; // Negative means client owes money

    return {
      totalHonorarios,
      totalGastos,
      totalPagos,
      balance,
    };
  }
  async update(id: string, updateMovimientoDto: Partial<Movimiento>, userId: string) {
    const movimiento = await this.movimientosRepository.findOne({ where: { id, userId } });
    if (!movimiento) {
      throw new Error('Movimiento not found or access denied');
    }
    await this.movimientosRepository.update(id, updateMovimientoDto);
    return this.movimientosRepository.findOne({ where: { id } });
  }

  async remove(id: string, userId: string) {
    const movimiento = await this.movimientosRepository.findOne({ where: { id, userId } });
    if (!movimiento) {
      throw new Error('Movimiento not found or access denied');
    }
    return this.movimientosRepository.delete(id);
  }
}
