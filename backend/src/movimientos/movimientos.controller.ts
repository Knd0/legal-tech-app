import { Controller, Get, Post, Body, Param, Request, UseGuards, Patch, Delete } from '@nestjs/common';
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
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMovimientoDto: Partial<Movimiento>, @Request() req) {
    return this.movimientosService.update(id, updateMovimientoDto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.movimientosService.remove(id, req.user.userId);
  }
}
