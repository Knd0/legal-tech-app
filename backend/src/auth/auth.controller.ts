import { Controller, Request, Post, UseGuards, Body, Get, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Controller('auth')
export class AuthController {
  constructor(
      private authService: AuthService,
      private usersService: UsersService
  ) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('register')
  async register(@Body() body) {
      const { email, password, fullName, phoneNumber } = body;
      const hashedPassword = await bcrypt.hash(password, 10);
      return this.usersService.create({
          email,
          passwordHash: hashedPassword,
          fullName,
          phoneNumber,
          subscriptionStatus: 'trial',
          isActive: true
      });
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Request() req) {
    return req.user;
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    await this.authService.requestForgotPasswordOtp(body.email);
    return { message: 'OTP sent' };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { email: string; otp: string; newPassword: string }) {
    await this.authService.resetPassword(body.email, body.otp, body.newPassword);
    return { message: 'Password reset successfully' };
  }

  @Post('request-password-otp')
  @UseGuards(AuthGuard('jwt'))
  async requestPasswordOtp(@Request() req) {
      await this.authService.requestPasswordChangeOtp(req.user.userId);
      return { message: 'OTP sent' };
  }

  @Post('change-password')
  @UseGuards(AuthGuard('jwt'))
  async changePassword(@Request() req, @Body() body) {
      const { otp, newPassword } = body;
      await this.authService.changePassword(req.user.userId, otp, newPassword);
      return { message: 'Password updated successfully' };
  }
}
