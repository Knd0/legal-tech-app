import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CalendarService {
  constructor(
    private configService: ConfigService,
  ) {}

  // Google Calendar integration removed
}
