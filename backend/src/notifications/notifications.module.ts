import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { DeadlinesModule } from '../deadlines/deadlines.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DeadlinesModule,
    WhatsappModule,
    SettingsModule
  ],
  providers: [NotificationsService],
})
export class NotificationsModule {}
