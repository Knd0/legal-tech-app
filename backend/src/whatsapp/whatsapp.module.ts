import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappSession } from './whatsapp-session.entity';
import { WhatsappQueue } from './whatsapp-queue.entity';
import { Client } from '../clients/client.entity';
import { Expediente } from '../expedientes/expediente.entity';
import { Deadline } from '../deadlines/deadline.entity';
import { Movimiento } from '../movimientos/entities/movimiento.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappSession, WhatsappQueue, Client, Expediente, Deadline, Movimiento])],
  providers: [WhatsappService],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
