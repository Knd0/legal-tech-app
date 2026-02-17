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
    await this.auditLogsService.log(userId, 'CREATE', 'MOVIMIENTO', saved.id, `Created ${saved.tipo} of $${saved.monto}`);
    return saved;
  }

  async findAllByClient(clientId: string, userId: string) {
    return this.movimientosRepository.find({
      where: { clientId, userId },
      order: { fecha: 'DESC', createdAt: 'DESC' },
    });
  }

  async getBalance(clientId: string, userId: string) {
    const movimientos = await this.findAllByClient(clientId, userId);
    
    let totalHonorarios = 0;
    let totalGastos = 0;
    let totalPagos = 0;

    movimientos.forEach(m => {
      const amount = Number(m.monto);
      if (m.tipo === 'HONORARIO') totalHonorarios += amount;
      if (m.tipo === 'GASTO') totalGastos += amount;
      if (m.tipo === 'PAGO') totalPagos += amount;
    });

    const totalDeuda = totalHonorarios + totalGastos;
    const balance = totalPagos - totalDeuda; // Negative means client owes money

    return {
      totalHonorarios,
      totalGastos,
      totalPagos,
      balance,
      movimientos
    };
  }
}
