import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('auth')
  @UseGuards(JwtAuthGuard)
  googleAuth(@Res() res) {
    const url = this.calendarService.getAuthUrl();
    return res.json({ url });
  }

  @Get('callback')
  @UseGuards(JwtAuthGuard)
  async googleAuthRedirect(@Query('code') code: string, @Req() req) {
    const userId = req.user.userId;
    const result = await this.calendarService.handleCallback(code, userId);
    return { message: result };
  }
}
