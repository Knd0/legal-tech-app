import {
  Controller,
  Request,
  Post,
  UseGuards,
  Body,
  Get,
  ConflictException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../users/users.service';
import { sanitizeUser } from '../users/user-response.util';
import * as bcrypt from 'bcrypt';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  PhoneNumberDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyPhoneOtpDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @UseGuards(AuthGuard('local'))
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    const existing = await this.usersService.findOneByEmail(body.email);
    if (existing) {
      throw new ConflictException('Ya existe una cuenta registrada con ese email.');
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);
    const user = await this.usersService.create({
      email: body.email,
      passwordHash: hashedPassword,
      fullName: body.fullName,
      phoneNumber: body.phoneNumber,
      isActive: true,
    });
    return sanitizeUser(user);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Request() req) {
    return req.user;
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    const { channel } = await this.authService.requestForgotPasswordOtp(body.email);
    return { message: 'OTP sent', channel };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.authService.resetPassword(body.email, body.otp, body.newPassword);
    return { message: 'Password reset successfully' };
  }

  @Post('request-password-otp')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestPasswordOtp(@Request() req) {
    await this.authService.requestPasswordChangeOtp(req.user.userId);
    return { message: 'OTP sent' };
  }

  @Post('change-password')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async changePassword(@Request() req, @Body() body: ChangePasswordDto) {
    await this.authService.changePassword(req.user.userId, body.otp, body.newPassword);
    return { message: 'Password updated successfully' };
  }

  @Post('request-phone-verification-otp')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestPhoneVerificationOtp(@Request() req, @Body() body: PhoneNumberDto) {
    await this.authService.requestPhoneVerificationOtp(req.user.userId, body.phoneNumber);
    return { message: 'OTP sent' };
  }

  @Post('verify-phone-otp')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyPhoneOtp(@Request() req, @Body() body: VerifyPhoneOtpDto) {
    await this.authService.verifyPhoneOtp(req.user.userId, body.phoneNumber, body.otp);
    return { message: 'Phone verified successfully' };
  }
}
