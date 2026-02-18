import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
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
    const payload = { username: user.email, sub: user.id, role: user.role, phoneNumber: user.phoneNumber, fullName: user.fullName };
    return {
      access_token: this.jwtService.sign(payload),
      user: user // user object from validateUser already has passwordHash removed
    };
  }

  // OTP functionalities
  private otps = new Map<string, { code: string, expires: number }>();

  async requestPasswordChangeOtp(userId: string): Promise<void> {
      const user = await this.usersService.findOneById(userId);
      if (!user || !user.phoneNumber) {
          throw new UnauthorizedException('User has no phone number linked');
      }

      // Generate 6 digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP (Expires in 5 minutes)
      this.otps.set(userId, { code, expires: Date.now() + 5 * 60 * 1000 });

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

      if (storedOtp.code !== otp) {
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
