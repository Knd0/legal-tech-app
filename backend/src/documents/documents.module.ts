import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { Documento } from './entities/document.entity';
import { ClientsModule } from '../clients/clients.module';
import { ExpedientesModule } from '../expedientes/expedientes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Documento]),
    ClientsModule,
    ExpedientesModule
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService]
})
export class DocumentsModule {}
