import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  findAll(@Request() req) {
    return this.calendarService.findAll(req.user.userId);
  }

  @Post()
  create(@Body() body: any, @Request() req) {
    return this.calendarService.create(body, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Request() req) {
    return this.calendarService.update(id, body, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.calendarService.remove(id, req.user.userId);
  }
}
