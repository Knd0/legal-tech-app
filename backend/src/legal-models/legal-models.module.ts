import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LegalModelsService } from './legal-models.service';
import { LegalModelsController } from './legal-models.controller';
import { LegalModel } from './legal-model.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([LegalModel]), AuditLogsModule],
  controllers: [LegalModelsController],
  providers: [LegalModelsService],
  exports: [LegalModelsService],
})
export class LegalModelsModule {}
