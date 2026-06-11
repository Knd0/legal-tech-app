import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { DeadlinesService } from '../deadlines/deadlines.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SettingsService } from '../settings/settings.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PushSubscription } from './entities/push-subscription.entity';
import { UsersService } from '../users/users.service';

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

  const mockUsersService = {
    findOneById: jest.fn().mockResolvedValue({
      id: 'lawyer-id',
      fullName: 'Dr. Test',
      phoneNumber: '5491122334455',
      isPhoneVerified: true,
      whatsappAlertsEnabled: true,
      desktopAlertsEnabled: true,
      alertDaysBefore: 3,
      alertRepetitions: 1,
      alertHour: 9,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: DeadlinesService, useValue: mockDeadlinesService },
        { provide: WhatsappService, useValue: mockWhatsappService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: getRepositoryToken(PushSubscription), useValue: mockPushSubscriptionRepository },
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
