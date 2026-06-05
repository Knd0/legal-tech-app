import { Test, TestingModule } from '@nestjs/testing';
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
