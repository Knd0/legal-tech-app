import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { DeadlinesService } from '../deadlines/deadlines.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SettingsService } from '../settings/settings.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PushSubscription } from './entities/push-subscription.entity';
import { UsersService } from '../users/users.service';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: DeadlinesService, useValue: mockDeadlinesService },
        { provide: WhatsappService, useValue: mockWhatsappService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(PushSubscription), useValue: mockPushSubscriptionRepository },
        { provide: UsersService, useValue: { findOneById: jest.fn() } },
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
});
