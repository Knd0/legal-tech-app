import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeadlinesService } from './deadlines.service';
import { DeadlinesController } from './deadlines.controller';
import { Deadline } from './deadline.entity';

import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deadline]),
    CalendarModule
  ],
  providers: [DeadlinesService],
  exports: [DeadlinesService],
  controllers: [DeadlinesController],
})
export class DeadlinesModule {}
