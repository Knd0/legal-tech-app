import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacturasService } from './facturas.service';
import { FacturasController } from './facturas.controller';
import { Factura } from './entities/factura.entity';
import { Client } from '../clients/client.entity';
import { UsersModule } from '../users/users.module';
import { ClientsModule } from '../clients/clients.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Factura, Client]),
    UsersModule,
    ClientsModule,
    WhatsappModule,
  ],
  controllers: [FacturasController],
  providers: [FacturasService],
})
export class FacturasModule {}
