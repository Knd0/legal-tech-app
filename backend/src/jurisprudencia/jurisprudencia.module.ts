import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Jurisprudencia } from './jurisprudencia.entity';
import { JurisprudenciaService } from './jurisprudencia.service';
import { JurisprudenciaController } from './jurisprudencia.controller';
import { SaijAdapter } from './adapters/saij.adapter';

@Module({
  imports: [TypeOrmModule.forFeature([Jurisprudencia])],
  controllers: [JurisprudenciaController],
  providers: [JurisprudenciaService, SaijAdapter],
  exports: [JurisprudenciaService],
})
export class JurisprudenciaModule {}
