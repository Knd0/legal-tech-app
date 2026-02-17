import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Client } from '../clients/client.entity';
import { Expediente } from '../expedientes/expediente.entity';
import { Deadline } from '../deadlines/deadline.entity';
import { Movimiento } from '../movimientos/entities/movimiento.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Expediente, Deadline, Movimiento])
  ],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
