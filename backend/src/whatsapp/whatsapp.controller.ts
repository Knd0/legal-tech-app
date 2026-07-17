import { Controller, Post, Body, Get, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)

export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('send')
  async sendMessage(@Body() body: { number: string; message: string }) {
    try {
      if (!body.number || !body.message) {
          throw new HttpException('Number and message are required', HttpStatus.BAD_REQUEST);
      }
      await this.whatsappService.sendMessage(body.number, body.message);
      return { success: true, message: 'Message sent' };
    } catch (error: any) {
      throw new HttpException(error.message || 'Failed to send message', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('status')
  getStatus() {
      return this.whatsappService.getStatus();
  }

  @Post('logout')
  @Roles('ADMIN')
  async logout() {
      try {
          await this.whatsappService.logout();
          return { success: true, message: 'Logged out successfully' };
      } catch (error: any) {
          throw new HttpException(error.message || 'Failed to logout', HttpStatus.INTERNAL_SERVER_ERROR);
      }
  }

  @Post('restart')
  @Roles('ADMIN')
  async restart() {
      try {
          await this.whatsappService.restart();
          return { success: true, message: 'Restarted successfully' };
      } catch (error: any) {
          throw new HttpException(error.message || 'Failed to restart', HttpStatus.INTERNAL_SERVER_ERROR);
      }
  }

  @Post('pairing-code')
  @Roles('ADMIN')
  async getPairingCode(@Body() body: { number: string }) {
      try {
          if (!body.number) {
              throw new HttpException('Number is required', HttpStatus.BAD_REQUEST);
          }
          const code = await this.whatsappService.requestPairingCode(body.number);
          return { success: true, code };
      } catch (error: any) {
          throw new HttpException(error.message || 'Failed to get pairing code', HttpStatus.INTERNAL_SERVER_ERROR);
      }
  }
}

