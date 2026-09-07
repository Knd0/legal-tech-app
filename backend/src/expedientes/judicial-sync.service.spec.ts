// `whatsapp.service.ts` importa Baileys, que es ESM puro y Jest no puede cargar.
jest.mock('@whiskeysockets/baileys', () => ({
  __esModule: true,
  default: jest.fn(),
  useMultiFileAuthState: jest.fn().mockResolvedValue({ state: {}, saveCreds: jest.fn() }),
  makeCacheableSignalKeyStore: jest.fn(),
  DisconnectReason: {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JudicialSyncService } from './judicial-sync.service';
import { Expediente } from './expediente.entity';
import { Actuacion } from './actuacion.entity';
import { User } from '../users/entities/user.entity';
import { WhatsappService } from '../whatsapp/whatsapp.service';

/**
 * `fetchNovedadesMock()` fabrica actuaciones que leen como plazos procesales
 * reales ("córrase traslado por cinco (5) días") y las notifica por WhatsApp.
 * Estas pruebas fijan que nada de eso ocurra sin `JUDICIAL_SYNC_ENABLED=true`.
 */
describe('JudicialSyncService - gating de la sincronización simulada', () => {
  let expedientesRepo: any;
  let actuacionesRepo: any;
  let whatsappService: any;

  const buildService = async (enabled: boolean): Promise<JudicialSyncService> => {
    if (enabled) {
      process.env.JUDICIAL_SYNC_ENABLED = 'true';
    } else {
      delete process.env.JUDICIAL_SYNC_ENABLED;
    }

    expedientesRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 'exp-1', portalJudicial: 'PJN', portalId: '123', autoSync: true },
      ]),
      findOne: jest.fn().mockResolvedValue({
        id: 'exp-1',
        userId: 'user-1',
        portalJudicial: 'PJN',
        portalId: '123',
        caratula: 'PEREZ C/ GOMEZ S/ DAÑOS',
        fechaInicio: new Date('2026-01-10'),
      }),
    };

    actuacionesRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'act-1', ...v })),
      find: jest.fn(),
      remove: jest.fn(),
    };

    whatsappService = { sendMessage: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JudicialSyncService,
        { provide: getRepositoryToken(Expediente), useValue: expedientesRepo },
        { provide: getRepositoryToken(Actuacion), useValue: actuacionesRepo },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 'user-1',
              isPhoneVerified: true,
              phoneNumber: '+5491100000000',
              alertWhatsapp: true,
            }),
          },
        },
        { provide: WhatsappService, useValue: whatsappService },
      ],
    }).compile();

    return module.get<JudicialSyncService>(JudicialSyncService);
  };

  afterEach(() => {
    delete process.env.JUDICIAL_SYNC_ENABLED;
  });

  describe('con el flag apagado (default de producción)', () => {
    it('syncExpediente falla de forma explícita en vez de decir "sin novedades"', async () => {
      const service = await buildService(false);

      await expect(service.syncExpediente('exp-1', 'user-1')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('no persiste ninguna actuación inventada', async () => {
      const service = await buildService(false);

      await service.syncExpediente('exp-1', 'user-1').catch(() => undefined);

      expect(actuacionesRepo.save).not.toHaveBeenCalled();
    });

    it('no envía alertas de WhatsApp por movimientos que no existen', async () => {
      const service = await buildService(false);

      await service.syncExpediente('exp-1', 'user-1').catch(() => undefined);

      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('el cron nocturno no recorre expedientes', async () => {
      const service = await buildService(false);

      await service.handleNightlySync();

      expect(expedientesRepo.find).not.toHaveBeenCalled();
      expect(actuacionesRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('con el flag encendido (demos y desarrollo)', () => {
    it('marca lo generado como SIMULADO, nunca como AUTOMATICO', async () => {
      const service = await buildService(true);

      await service.syncExpediente('exp-1', 'user-1');

      const origenes = actuacionesRepo.create.mock.calls.map((c: any[]) => c[0].origen);
      expect(origenes.length).toBeGreaterThan(0);
      for (const origen of origenes) {
        expect(origen).toMatch(/^SIMULADO_/);
      }
    });

    it('advierte en el propio mensaje de WhatsApp que el dato es simulado', async () => {
      const service = await buildService(true);

      await service.syncExpediente('exp-1', 'user-1');

      expect(whatsappService.sendMessage).toHaveBeenCalled();
      const [, mensaje] = whatsappService.sendMessage.mock.calls[0];
      expect(mensaje).toContain('DEMO');
      expect(mensaje).toContain('simulado');
    });
  });
});
