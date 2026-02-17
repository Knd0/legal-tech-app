import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpedientesService } from './expedientes.service';
import { ExpedientesController } from './expedientes.controller';
import { Expediente } from './expediente.entity';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([Expediente]), AuditLogsModule],
  providers: [ExpedientesService],
  controllers: [ExpedientesController],
  exports: [ExpedientesService],
})
export class ExpedientesModule {}
