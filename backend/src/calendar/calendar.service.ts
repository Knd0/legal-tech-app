import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class CalendarService {
  private oauth2Client: OAuth2Client;

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    const clientId = this.configService.get('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get('GOOGLE_CALLBACK_URL');

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
  }

  getAuthUrl(): string {
    const scopes = ['https://www.googleapis.com/auth/calendar.events'];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      scope: scopes,
      prompt: 'consent' // Force new refresh token
    });
  }

  async handleCallback(code: string, userId: string): Promise<string> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (tokens.refresh_token) {
        await this.userRepository.update(userId, {
            googleRefreshToken: tokens.refresh_token
        });
      }

      return 'Google Calendar Connected Successfully';
    } catch (error) {
       console.error('Error getting tokens', error);
       throw new BadRequestException('Failed to connect to Google');
    }
  }

  // Method to create an event
  async createEvent(userId: string, eventData: any) {
      const user = await this.userRepository.findOneBy({ id: userId });
      if (!user || !user.googleRefreshToken) {
          // If no token, we just skip or log
          console.log(`User ${userId} not connected to Google Calendar`);
          return;
      }

      this.oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const event = {
        summary: eventData.title,
        description: eventData.description,
        start: {
            dateTime: eventData.startDate.toISOString(), // '2023-01-01T09:00:00-07:00'
        },
        end: {
            dateTime: eventData.endDate.toISOString(),
        },
      };

      try {
          await calendar.events.insert({
              calendarId: 'primary',
              requestBody: event,
          });
          console.log(`Event created in Google Calendar for user ${userId}`);
      } catch (error) {
          console.error('Error creating Google Calendar event', error);
      }
  }
}
