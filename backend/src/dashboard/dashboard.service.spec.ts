import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { Client } from '../clients/client.entity';
import { Expediente } from '../expedientes/expediente.entity';
import { Deadline } from '../deadlines/deadline.entity';
import { Movimiento } from '../movimientos/entities/movimiento.entity';

describe('DashboardService', () => {
  let service: DashboardService;
  let movimientoRepo: any;

  beforeEach(async () => {
    movimientoRepo = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Client), useValue: { count: jest.fn().mockResolvedValue(3) } },
        { provide: getRepositoryToken(Expediente), useValue: { count: jest.fn().mockResolvedValue(7) } },
        { provide: getRepositoryToken(Deadline), useValue: { count: jest.fn().mockResolvedValue(2) } },
        { provide: getRepositoryToken(Movimiento), useValue: movimientoRepo },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('etiquetas de meses', () => {
    /**
     * Regresión: se usaba `format(date, 'MMM')` de date-fns sin locale, así que
     * el eje del gráfico mostraba "Apr", "Sep" en una interfaz en español.
     */
    it('devuelve los meses en español, no en inglés', async () => {
      const history = await service.getFinancialHistory('user-1');
      const meses = history.map((h) => h.month);

      expect(meses).toHaveLength(6);

      const mesesEnIngles = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (const mes of meses) {
        expect(mesesEnIngles).not.toContain(mes);
      }
    });

    it('no deja el punto abreviador en la etiqueta', async () => {
      const history = await service.getFinancialHistory('user-1');
      for (const h of history) {
        expect(h.month).not.toContain('.');
      }
    });

    it('devuelve seis meses consecutivos terminando en el actual', async () => {
      const history = await service.getFinancialHistory('user-1');
      const esperado = new Date().toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');

      expect(history).toHaveLength(6);
      expect(history[history.length - 1].month).toBe(esperado);
    });
  });

  describe('getStats', () => {
    it('agrega los contadores y el historial financiero', async () => {
      const stats = await service.getStats('user-1');

      expect(stats.clients).toBe(3);
      expect(stats.expedientes).toBe(7);
      expect(stats.deadlines).toBe(2);
      expect(stats.financials).toHaveLength(6);
    });

    it('cuenta pagos como ingreso y gastos como egreso, no los honorarios', async () => {
      // Un honorario devengado todavía no es plata cobrada.
      movimientoRepo.find.mockResolvedValue([
        { tipo: 'PAGO', monto: '1000' },
        { tipo: 'GASTO', monto: '250' },
        { tipo: 'HONORARIO', monto: '99999' },
      ]);

      const history = await service.getFinancialHistory('user-1');

      expect(history[0].income).toBe(1000);
      expect(history[0].expense).toBe(250);
    });
  });
});
