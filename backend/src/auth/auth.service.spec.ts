import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Otp } from './otp.entity';
import { UnauthorizedException } from '@nestjs/common';

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

describe('AuthService - OTP Persistence', () => {
  let service: AuthService;
  let otpRepositoryMock: any;
  let usersServiceMock: any;
  let whatsappServiceMock: any;

  beforeEach(async () => {
    otpRepositoryMock = {
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      findOneBy: jest.fn(),
      delete: jest.fn().mockResolvedValue(true),
    };

    usersServiceMock = {
      findOneByEmail: jest.fn().mockResolvedValue({ id: 'user-1', email: 'test@estudio.com', phoneNumber: '123456' }),
      findOneById: jest.fn().mockResolvedValue({ id: 'user-1', phoneNumber: '123456' }),
      updatePassword: jest.fn().mockResolvedValue(true),
    };

    whatsappServiceMock = {
      sendMessage: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('mock-token') } },
        { provide: WhatsappService, useValue: whatsappServiceMock },
        { provide: getRepositoryToken(Otp), useValue: otpRepositoryMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should save a new OTP and send WhatsApp in requestForgotPasswordOtp', async () => {
    const result = await service.requestForgotPasswordOtp('test@estudio.com');

    expect(otpRepositoryMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'forgot_test@estudio.com',
        code: expect.any(String),
        expiresAt: expect.any(Date),
        attempts: 0,
      })
    );
    expect(whatsappServiceMock.sendMessage).toHaveBeenCalledWith('123456', expect.stringContaining('Tu código para restablecer la contraseña es'));
    expect(result).toEqual({ channel: 'whatsapp' });
  });

  it('should throw and increment attempts when code is incorrect in resetPassword', async () => {
    const expiresFuture = new Date(Date.now() + 5 * 60 * 1000);
    otpRepositoryMock.findOneBy.mockResolvedValue({
      key: 'forgot_test@estudio.com',
      code: '123456',
      expiresAt: expiresFuture,
      attempts: 2,
    });

    await expect(service.resetPassword('test@estudio.com', '999999', 'newPassword')).rejects.toThrow(UnauthorizedException);
    expect(otpRepositoryMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'forgot_test@estudio.com',
        attempts: 3,
      })
    );
  });

  it('should throw and delete OTP when code is expired in resetPassword', async () => {
    const expiresPast = new Date(Date.now() - 1000);
    otpRepositoryMock.findOneBy.mockResolvedValue({
      key: 'forgot_test@estudio.com',
      code: '123456',
      expiresAt: expiresPast,
      attempts: 0,
    });

    await expect(service.resetPassword('test@estudio.com', '123456', 'newPassword')).rejects.toThrow(UnauthorizedException);
    expect(otpRepositoryMock.delete).toHaveBeenCalledWith('forgot_test@estudio.com');
  });

  it('should update password and delete OTP on success in resetPassword', async () => {
    const expiresFuture = new Date(Date.now() + 5 * 60 * 1000);
    otpRepositoryMock.findOneBy.mockResolvedValue({
      key: 'forgot_test@estudio.com',
      code: '123456',
      expiresAt: expiresFuture,
      attempts: 0,
    });

    await service.resetPassword('test@estudio.com', '123456', 'newPassword');

    expect(usersServiceMock.updatePassword).toHaveBeenCalledWith('user-1', expect.any(String));
    expect(otpRepositoryMock.delete).toHaveBeenCalledWith('forgot_test@estudio.com');
  });
});
