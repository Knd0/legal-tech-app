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
    const { channel } = await this.authService.requestForgotPasswordOtp(body.email);
    return { message: 'OTP sent', channel };
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

  @Post('request-phone-verification-otp')
  @UseGuards(AuthGuard('jwt'))
  async requestPhoneVerificationOtp(@Request() req, @Body() body: { phoneNumber: string }) {
      await this.authService.requestPhoneVerificationOtp(req.user.userId, body.phoneNumber);
      return { message: 'OTP sent' };
  }

  @Post('verify-phone-otp')
  @UseGuards(AuthGuard('jwt'))
  async verifyPhoneOtp(@Request() req, @Body() body: { phoneNumber: string; otp: string }) {
      await this.authService.verifyPhoneOtp(req.user.userId, body.phoneNumber, body.otp);
      return { message: 'Phone verified successfully' };
  }
}
