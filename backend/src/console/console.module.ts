import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../users/entities/subscription.entity';
import { Client } from '../clients/client.entity';
import { Expediente } from '../expedientes/expediente.entity';
import { ConsoleController } from './console.controller';
import { ConsoleService } from './console.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Subscription, Client, Expediente])],
  controllers: [ConsoleController],
  providers: [ConsoleService],
})
export class ConsoleModule {}
