import { Module } from '@nestjs/common';
import { MercadopagoService } from './mercadopago.service';
import { MercadopagoController } from './mercadopago.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [MercadopagoService],
  controllers: [MercadopagoController],
  exports: [MercadopagoService],
})
export class MercadopagoModule {}
