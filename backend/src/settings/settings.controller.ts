import { Controller, Get, Body, Param, Put, Post, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @Put(':key')
  @Roles('ADMIN')
  update(@Param('key') key: string, @Body('value') value: string) {
    return this.settingsService.update(key, value);
  }

  @Post()
  @Roles('ADMIN')
  updateBulk(@Body() settings: any) {
      return this.settingsService.updateMany(settings);
  }
}

