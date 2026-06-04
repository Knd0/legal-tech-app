import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class AuthService {


  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private whatsappService: WhatsappService
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
      fullName: user.fullName, 
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: user // user object from validateUser already has passwordHash removed
    };
  }

  // OTP functionalities
  private otps = new Map<string, { code: string; expires: number; attempts: number }>();
  private readonly MAX_OTP_ATTEMPTS = 5;

  async requestForgotPasswordOtp(email: string): Promise<void> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user || !user.phoneNumber) {
      throw new UnauthorizedException('No se encontró una cuenta con ese email o no tiene teléfono vinculado.');
    }
    const code = randomInt(100000, 1000000).toString();
    this.otps.set(`forgot_${email}`, { code, expires: Date.now() + 5 * 60 * 1000, attempts: 0 });
    try {
      await this.whatsappService.sendMessage(
        user.phoneNumber,
        `Tu código para restablecer la contraseña es: *${code}*. Expira en 5 minutos.`
      );
    } catch (error: any) {
      this.otps.delete(`forgot_${email}`);
      throw new UnauthorizedException('No se pudo enviar el código por WhatsApp.');
    }
  }

  async resetPassword(email: string, otp: string, newPass: string): Promise<void> {
    const key = `forgot_${email}`;
    const stored = this.otps.get(key);
    if (!stored) throw new UnauthorizedException('No hay un código activo. Solicitá uno nuevo.');
    if (Date.now() > stored.expires) {
      this.otps.delete(key);
      throw new UnauthorizedException('El código expiró. Solicitá uno nuevo.');
    }
    if (stored.attempts >= this.MAX_OTP_ATTEMPTS) {
      this.otps.delete(key);
      throw new UnauthorizedException('Demasiados intentos fallidos. Solicitá un nuevo código.');
    }
    if (stored.code !== otp) {
      stored.attempts++;
      throw new UnauthorizedException(`Código incorrecto. Intentos restantes: ${this.MAX_OTP_ATTEMPTS - stored.attempts}`);
    }
    const user = await this.usersService.findOneByEmail(email);
    if (!user) throw new UnauthorizedException('Usuario no encontrado.');
    const passwordHash = await bcrypt.hash(newPass, 10);
    await this.usersService.updatePassword(user.id, passwordHash);
    this.otps.delete(key);
  }

  async requestPasswordChangeOtp(userId: string): Promise<void> {
      const user = await this.usersService.findOneById(userId);
      if (!user || !user.phoneNumber) {
          throw new UnauthorizedException('User has no phone number linked');
      }

      const code = randomInt(100000, 1000000).toString();
      this.otps.set(userId, { code, expires: Date.now() + 5 * 60 * 1000, attempts: 0 });

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
      const storedOtp = this.otps.get(userId);
      
      if (!storedOtp) {
          throw new UnauthorizedException('No OTP request found');
      }

      if (Date.now() > storedOtp.expires) {
          this.otps.delete(userId);
          throw new UnauthorizedException('OTP expired');
      }

      if (storedOtp.attempts >= this.MAX_OTP_ATTEMPTS) {
          this.otps.delete(userId);
          throw new UnauthorizedException('Demasiados intentos fallidos. Solicitá un nuevo código.');
      }
      if (storedOtp.code !== otp) {
          storedOtp.attempts++;
          throw new UnauthorizedException('Invalid OTP');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPass, 10);
      
      // Update User
      await this.usersService.updatePassword(userId, passwordHash);

      // Clear OTP
      this.otps.delete(userId);
  }
}
