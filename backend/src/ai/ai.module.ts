import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ExpedientesModule } from '../expedientes/expedientes.module';
import { LegalModelsModule } from '../legal-models/legal-models.module';

@Module({
  imports: [ExpedientesModule, LegalModelsModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
