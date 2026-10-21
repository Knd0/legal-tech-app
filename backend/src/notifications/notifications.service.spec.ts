import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { DeadlinesService } from '../deadlines/deadlines.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SettingsService } from '../settings/settings.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PushSubscription } from './entities/push-subscription.entity';
import { UsersService } from '../users/users.service';
import { PlanService } from '../plan/plan.service';

jest.mock('@whiskeysockets/baileys', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    ev: { on: jest.fn() },
    onWhatsApp: jest.fn().mockResolvedValue([{ exists: true, jid: 'test@s.whatsapp.net' }]),
    sendMessage: jest.fn().mockResolvedValue({}),
  }),
  useMultiFileAuthState: jest.fn().mockResolvedValue({
    state: { creds: { registered: true }, keys: {} },
    saveCreds: jest.fn(),
  }),
  DisconnectReason: { loggedOut: 401 },
  makeCacheableSignalKeyStore: jest.fn().mockImplementation((keys) => keys),
}));

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockDeadlinesService = {
    findAll: jest.fn().mockResolvedValue([]),
  };

  const mockWhatsappService = {
    sendMessage: jest.fn(),
  };

  const mockSettingsService = {
    getSettings: jest.fn().mockResolvedValue({
      enableWhatsapp: true,
      daysBeforeAlert: 3,
    }),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      return null;
    }),
  };

  const mockPushSubscriptionRepository = {
    findBy: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockUsersService = { findOneById: jest.fn() };
  const mockPlanService = { accessFor: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: DeadlinesService, useValue: mockDeadlinesService },
        { provide: WhatsappService, useValue: mockWhatsappService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(PushSubscription), useValue: mockPushSubscriptionRepository },
        { provide: UsersService, useValue: mockUsersService },
        { provide: PlanService, useValue: mockPlanService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return VAPID public key', () => {
    expect(service.getVapidPublicKey()).toBeTruthy();
    expect(typeof service.getVapidPublicKey()).toBe('string');
  });

  describe('aviso diario por WhatsApp según el plan', () => {
    const manana = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; };
    const abogado = {
      id: 'u1', role: 'USER', email: 'a@b.com', phoneNumber: '5493455000000', isPhoneVerified: true,
      alertWhatsapp: true, alertPush: false, daysBeforeAlert: 1, daysBeforeAlertSecondary: 0, alertOnDueDate: false,
      alertTypeAudiencias: true, alertTypeVencimientos: true, alertTypeEscritos: true,
    };

    beforeEach(() => {
      mockDeadlinesService.findAll.mockResolvedValue([
        { titulo: 'Contestar demanda', tipo: 'VENCIMIENTO_PLAZO', estado: 'PENDIENTE', fechaVencimiento: manana(), userId: 'u1' },
      ]);
      mockUsersService.findOneById.mockResolvedValue(abogado);
    });

    it('envía el WhatsApp con el plan Profesional', async () => {
      mockPlanService.accessFor.mockResolvedValue({ state: 'active', features: { whatsapp: true } });
      await service.handleCron();
      expect(mockWhatsappService.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('no lo envía con el plan Básico', async () => {
      mockPlanService.accessFor.mockResolvedValue({ state: 'active', features: { whatsapp: false } });
      await service.handleCron();
      expect(mockWhatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('no lo envía con la suscripción vencida', async () => {
      mockPlanService.accessFor.mockResolvedValue({ state: 'expired', features: { whatsapp: true } });
      await service.handleCron();
      expect(mockWhatsappService.sendMessage).not.toHaveBeenCalled();
    });
  });
});
