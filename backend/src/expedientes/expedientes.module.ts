import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpedientesService } from './expedientes.service';
import { ExpedientesController } from './expedientes.controller';
import { Expediente } from './expediente.entity';
import { Actuacion } from './actuacion.entity';
import { User } from '../users/entities/user.entity';
import { JudicialSyncService } from './judicial-sync.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expediente, Actuacion, User]),
    AuditLogsModule,
    WhatsappModule,
  ],
  providers: [ExpedientesService, JudicialSyncService],
  controllers: [ExpedientesController],
  exports: [ExpedientesService, JudicialSyncService, TypeOrmModule],
})
export class ExpedientesModule {}
