import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Resend } from 'resend';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Otp } from './otp.entity';

@Injectable()
export class AuthService {

  private resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  private readonly MAX_OTP_ATTEMPTS = 5;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private whatsappService: WhatsappService,
    @InjectRepository(Otp)
    private readonly otpRepository: Repository<Otp>
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmail(email);
    if (user && await bcrypt.compare(pass, user.passwordHash)) {
      if (!user.isActive) {
          throw new UnauthorizedException('Account suspended. Contact administrator.');
      }
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      username: user.email,
      sub: user.id,
      role: user.role,
      phoneNumber: user.phoneNumber,
      isPhoneVerified: user.isPhoneVerified || false,
      daysBeforeAlert: user.daysBeforeAlert !== undefined ? user.daysBeforeAlert : 1,
      fullName: user.fullName,
      subscriptionStatus: user.subscription?.subscriptionStatus || 'trial',
      subscriptionPlan: user.subscription?.subscriptionPlan || 'pro',
      subscriptionExpiresAt: user.subscription?.subscriptionExpiresAt
    };

    const { passwordHash, subscription, ...userRest } = user;
    const flattenedUser = {
      ...userRest,
      subscriptionStatus: subscription?.subscriptionStatus || 'trial',
      subscriptionExpiresAt: subscription?.subscriptionExpiresAt || null,
      mpSubscriptionId: subscription?.mpSubscriptionId || null,
      subscriptionPlan: subscription?.subscriptionPlan || 'pro',
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: flattenedUser
    };
  }

  // OTP functionalities
  async requestForgotPasswordOtp(email: string): Promise<{ channel: 'whatsapp' | 'email' }> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new UnauthorizedException('No se encontró una cuenta con ese email.');
    }
    const code = randomInt(100000, 1000000).toString();
    const key = `forgot_${email}`;

    await this.otpRepository.save({
      key,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0
    });

    if (user.phoneNumber) {
      try {
        await this.whatsappService.sendMessage(
          user.phoneNumber,
          `Tu código para restablecer la contraseña es: *${code}*. Expira en 5 minutos.`
        );
        return { channel: 'whatsapp' };
      } catch {
        // WhatsApp falló — intentar fallback por email
      }
    }

    if (this.resend) {
      try {
        await this.resend.emails.send({
          from: 'Themis <no-reply@themis.com.ar>',
          to: email,
          subject: 'Código para restablecer tu contraseña',
          html: `<p>Tu código para restablecer la contraseña es: <strong>${code}</strong></p><p>Expira en 5 minutos.</p>`,
        });
        return { channel: 'email' };
      } catch (emailError: any) {
        console.error('Resend email error:', emailError);
      }
    }

    await this.otpRepository.delete(key);
    throw new UnauthorizedException('No se pudo enviar el código. Intentá más tarde.');
  }

  async resetPassword(email: string, otp: string, newPass: string): Promise<void> {
    const key = `forgot_${email}`;
    const stored = await this.otpRepository.findOneBy({ key });
    if (!stored) throw new UnauthorizedException('No hay un código activo. Solicitá uno nuevo.');
    
    if (new Date() > stored.expiresAt) {
      await this.otpRepository.delete(key);
      throw new UnauthorizedException('El código expiró. Solicitá uno nuevo.');
    }
    
    if (stored.attempts >= this.MAX_OTP_ATTEMPTS) {
      await this.otpRepository.delete(key);
      throw new UnauthorizedException('Demasiados intentos fallidos. Solicitá un nuevo código.');
    }
    
    if (stored.code !== otp) {
      stored.attempts++;
      await this.otpRepository.save(stored);
      throw new UnauthorizedException(`Código incorrecto. Intentos restantes: ${this.MAX_OTP_ATTEMPTS - stored.attempts}`);
    }
    
    const user = await this.usersService.findOneByEmail(email);
    if (!user) throw new UnauthorizedException('Usuario no encontrado.');
    
    const passwordHash = await bcrypt.hash(newPass, 10);
    await this.usersService.updatePassword(user.id, passwordHash);
    await this.otpRepository.delete(key);
  }

  async requestPasswordChangeOtp(userId: string): Promise<void> {
      const user = await this.usersService.findOneById(userId);
      if (!user || !user.phoneNumber) {
          throw new UnauthorizedException('User has no phone number linked');
      }

      const code = randomInt(100000, 1000000).toString();
      
      await this.otpRepository.save({
        key: userId,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0
      });

      // Send via WhatsApp
      try {
          await this.whatsappService.sendMessage(user.phoneNumber, `Tu código de verificación para cambiar la contraseña es: *${code}*`);
      } catch (error: any) {
          console.error('WhatsApp OTP Error:', error);
          if (error.message.includes('not ready')) {
             throw new UnauthorizedException('El servicio de WhatsApp se está reiniciando. Intente en unos segundos.');
          }
          throw new UnauthorizedException('No se pudo enviar el WhatsApp. Verifique que el número esté vinculado.');
      }
  }

  async changePassword(userId: string, otp: string, newPass: string): Promise<void> {
      const storedOtp = await this.otpRepository.findOneBy({ key: userId });
      
      if (!storedOtp) {
          throw new UnauthorizedException('No OTP request found');
      }

      if (new Date() > storedOtp.expiresAt) {
          await this.otpRepository.delete(userId);
          throw new UnauthorizedException('OTP expired');
      }

      if (storedOtp.attempts >= this.MAX_OTP_ATTEMPTS) {
          await this.otpRepository.delete(userId);
          throw new UnauthorizedException('Demasiados intentos fallidos. Solicitá un nuevo código.');
      }
      
      if (storedOtp.code !== otp) {
          storedOtp.attempts++;
          await this.otpRepository.save(storedOtp);
          throw new UnauthorizedException('Invalid OTP');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPass, 10);
      
      // Update User
      await this.usersService.updatePassword(userId, passwordHash);

      // Clear OTP
      await this.otpRepository.delete(userId);
  }

  async requestPhoneVerificationOtp(userId: string, phoneNumber: string): Promise<void> {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
          throw new UnauthorizedException('Número de teléfono inválido');
      }

      const code = randomInt(100000, 1000000).toString();
      const key = `verify_phone_${userId}`;
      
      await this.otpRepository.save({
        key,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        attempts: 0
      });

      // Send via WhatsApp
      try {
          await this.whatsappService.sendMessage(cleanPhone, `Tu código de verificación para vincular tu WhatsApp en Themis es: *${code}*`);
      } catch (error: any) {
          console.error('WhatsApp Verification OTP Error:', error);
          if (error.message.includes('not ready')) {
             throw new UnauthorizedException('El servicio de WhatsApp se está reiniciando. Intente en unos segundos.');
          }
          throw new UnauthorizedException('No se pudo enviar el WhatsApp. Asegúrate de que el bot de la plataforma esté conectado.');
      }
  }

  async verifyPhoneOtp(userId: string, phoneNumber: string, otp: string): Promise<void> {
      const key = `verify_phone_${userId}`;
      const storedOtp = await this.otpRepository.findOneBy({ key });
      
      if (!storedOtp) {
          throw new UnauthorizedException('No se encontró una solicitud de verificación.');
      }

      if (new Date() > storedOtp.expiresAt) {
          await this.otpRepository.delete(key);
          throw new UnauthorizedException('El código ha expirado.');
      }

      if (storedOtp.attempts >= this.MAX_OTP_ATTEMPTS) {
          await this.otpRepository.delete(key);
          throw new UnauthorizedException('Demasiados intentos fallidos. Solicitá un nuevo código.');
      }
      
      if (storedOtp.code !== otp) {
          storedOtp.attempts++;
          await this.otpRepository.save(storedOtp);
          throw new UnauthorizedException('Código incorrecto.');
      }

      // Update User phone and set isPhoneVerified = true
      await this.usersService.updateProfile(userId, {
          phoneNumber: phoneNumber,
          isPhoneVerified: true
      } as any);

      // Clear OTP
      await this.otpRepository.delete(key);
  }
}
