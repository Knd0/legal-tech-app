import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ClientsModule } from './clients/clients.module';
import { ExpedientesModule } from './expedientes/expedientes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DeadlinesModule } from './deadlines/deadlines.module';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { MovimientosModule } from './movimientos/movimientos.module';
import { DocumentsModule } from './documents/documents.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SettingsModule } from './settings/settings.module';
import { CalendarModule } from './calendar/calendar.module';
import { FacturasModule } from './facturas/facturas.module';
import { SeedService } from './seed.service';
import { MercadopagoModule } from './mercadopago/mercadopago.module';
import { AiModule } from './ai/ai.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL');

        if (dbUrl) {
          return {
            type: 'postgres',
            url: dbUrl,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true, // Auto-create tables (dev only, but useful for initial deploy)
            ssl: {
              rejectUnauthorized: false,
            },
            extra: {
              connectionTimeoutMillis: 30000, // Wait 30s before timing out
            },
            retryAttempts: 10, // Retry connection 10 times
            retryDelay: 3000, // Wait 3s between retries
            autoLoadEntities: true,
          };
        }

        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true,
          retryAttempts: 10,
          retryDelay: 3000,
        };
      },
      inject: [ConfigService],
    }),
    WhatsappModule,
    ClientsModule,
    ExpedientesModule,
    NotificationsModule,
    DeadlinesModule,

    AuthModule,
    UsersModule,
    AuditLogsModule,
    MovimientosModule,
    DocumentsModule,
    DashboardModule,
    SettingsModule,
    CalendarModule,
    FacturasModule,
    MercadopagoModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule {}
