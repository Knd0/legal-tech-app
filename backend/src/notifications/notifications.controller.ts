import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: this.notificationsService.getVapidPublicKey() };
  }

  @Post('subscribe')
  async subscribe(
    @Req() req: any,
    @Body() body: { endpoint: string; expirationTime?: number; keys: { p256dh: string; auth: string } },
  ) {
    const userId = req.user.userId;
    await this.notificationsService.subscribe(userId, body);
    return { success: true };
  }

  @Post('unsubscribe')
  async unsubscribe(
    @Req() req: any,
    @Body() body: { endpoint: string },
  ) {
    const userId = req.user.userId;
    await this.notificationsService.unsubscribe(userId, body.endpoint);
    return { success: true };
  }
}
