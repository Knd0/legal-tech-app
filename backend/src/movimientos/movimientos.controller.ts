import { Controller, Get, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import { MovimientosService } from './movimientos.service';
import { Movimiento } from './entities/movimiento.entity';
import { AuthGuard } from '@nestjs/passport';

@Controller('movimientos')
@UseGuards(AuthGuard('jwt'))
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Post()
  create(@Body() createMovimientoDto: Partial<Movimiento>, @Request() req) {
    return this.movimientosService.create(createMovimientoDto, req.user.userId);
  }

  @Get('client/:clientId')
  findAllByClient(@Param('clientId') clientId: string, @Request() req) {
    return this.movimientosService.findAllByClient(clientId, req.user.userId);
  }

  @Get('client/:clientId/balance')
  getBalance(@Param('clientId') clientId: string, @Request() req) {
    return this.movimientosService.getBalance(clientId, req.user.userId);
  }
}
