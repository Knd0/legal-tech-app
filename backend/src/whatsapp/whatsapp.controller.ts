import { Controller, Post, Body, Get, HttpException, HttpStatus } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
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
  async logout() {
      try {
          await this.whatsappService.logout();
          return { success: true, message: 'Logged out successfully' };
      } catch (error: any) {
          throw new HttpException(error.message || 'Failed to logout', HttpStatus.INTERNAL_SERVER_ERROR);
      }
  }
}
