import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not } from 'typeorm';
import { Client } from '../clients/client.entity';
import { Expediente } from '../expedientes/expediente.entity';
import { Deadline } from '../deadlines/deadline.entity';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(Expediente) private expedienteRepo: Repository<Expediente>,
    @InjectRepository(Deadline) private deadlineRepo: Repository<Deadline>,
    @InjectRepository(Movimiento) private movimientoRepo: Repository<Movimiento>,
  ) {}

  async getStats(userId: string) {
    const clientsCount = await this.clientRepo.count({ where: { userId } });
    
    // Count all active expedientes (not archived)
    const expedientesCount = await this.expedienteRepo.count({ 
        where: { 
            userId, 
            estado: Not('ARCHIVADO') 
        } 
    });
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const deadlinesCount = await this.deadlineRepo.count({ 
        where: { 
            // userId, // Temporarily commented to match DeadlinesService which returns all
            estado: 'PENDIENTE',
        } 
    });

    const financialData = await this.getFinancialHistory(userId);

    return {
        clients: clientsCount,
        expedientes: expedientesCount,
        deadlines: deadlinesCount,
        financials: financialData
    };
  }

  async getFinancialHistory(userId: string) {
      const months = 6;
      const history = [];
      
      for (let i = months - 1; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const start = startOfMonth(date);
          const end = endOfMonth(date);
          
          const movimientos = await this.movimientoRepo.find({
              where: {
                  userId,
                  fecha: Between(start, end) // Assuming movement has a date field
              }
          });

          let income = 0;
          let expense = 0;

          movimientos.forEach(m => {
              const amount = Number(m.monto);
              if (m.tipo === 'PAGO') income += amount;
              if (m.tipo === 'GASTO') expense += amount;
              // Honorarios generated are not 'income' until paid, technically. 
              // But for this simple view: 'PAGO' is real money IN. 'GASTO' is money OUT.
          });

          history.push({
              month: format(date, 'MMM'),
              income,
              expense
          });
      }
      return history;
  }
}
