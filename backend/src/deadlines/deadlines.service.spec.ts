import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DeadlinesService } from './deadlines.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Deadline } from './deadline.entity';
import { CalendarService } from '../calendar/calendar.service';

describe('DeadlinesService', () => {
  let service: DeadlinesService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadlinesService,
        {
          provide: getRepositoryToken(Deadline),
          useValue: repoMock,
        },
        {
          provide: CalendarService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<DeadlinesService>(DeadlinesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });


  /**
   * Regresión de IDOR: `GET/PUT/DELETE /deadlines/:id` no filtraban por dueño,
   * así que cualquier usuario autenticado podía tocar los vencimientos de otro
   * estudio enumerando UUIDs.
   */
  describe('aislamiento por inquilino', () => {
    it('findOne filtra por id y userId', async () => {
      repoMock.findOne.mockResolvedValue(null);

      await service.findOne('deadline-1', 'user-1');

      expect(repoMock.findOne).toHaveBeenCalledWith({
        where: { id: 'deadline-1', userId: 'user-1' },
        relations: ['expediente'],
      });
    });

    it('update sólo afecta al vencimiento del propio usuario', async () => {
      repoMock.update.mockResolvedValue({ affected: 1 });

      await service.update('deadline-1', { descripcion: 'Nueva' } as any, 'user-1');

      expect(repoMock.update).toHaveBeenCalledWith(
        { id: 'deadline-1', userId: 'user-1' },
        { descripcion: 'Nueva' },
      );
    });

    it('update no permite reasignar el dueño desde el body', async () => {
      repoMock.update.mockResolvedValue({ affected: 1 });

      await service.update('deadline-1', { userId: 'victima', id: 'otro' } as any, 'user-1');

      expect(repoMock.update.mock.calls[0][1]).not.toHaveProperty('userId');
      expect(repoMock.update.mock.calls[0][1]).not.toHaveProperty('id');
    });

    it('update de un vencimiento ajeno devuelve 404', async () => {
      repoMock.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.update('de-otro', { descripcion: 'X' } as any, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('remove sólo borra el vencimiento del propio usuario', async () => {
      repoMock.delete.mockResolvedValue({ affected: 1 });

      await service.remove('deadline-1', 'user-1');

      expect(repoMock.delete).toHaveBeenCalledWith({ id: 'deadline-1', userId: 'user-1' });
    });

    it('remove de un vencimiento ajeno devuelve 404', async () => {
      repoMock.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove('de-otro', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('sumarDiasHabiles', () => {
    it('should return same date if days is 0', () => {
      const date = new Date('2026-06-05T12:00:00Z');
      const result = service.sumarDiasHabiles(date, 0);
      expect(result.toISOString()).toBe(date.toISOString());
    });

    it('should skip weekends', () => {
      // 2026-06-05 is Friday. Adding 1 business day should lead to Monday 2026-06-08.
      const date = new Date('2026-06-05T12:00:00Z');
      const result = service.sumarDiasHabiles(date, 1);
      expect(result.getDay()).toBe(1); // Monday
      expect(result.getDate()).toBe(8);
    });

    it('should skip holidays (May 25 - Revolución de Mayo)', () => {
      // 2026-05-22 is Friday. Adding 1 business day skips Saturday 23, Sunday 24, and Monday 25 (Holiday).
      // It should land on Tuesday May 26.
      const date = new Date('2026-05-22T12:00:00Z');
      const result = service.sumarDiasHabiles(date, 1);
      expect(result.getDate()).toBe(26); // Tuesday
      expect(result.getMonth()).toBe(4); // May (0-indexed)
    });
  });
});
