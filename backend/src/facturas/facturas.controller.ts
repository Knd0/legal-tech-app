import { Controller, Post, Body, Req, UseGuards, Get, Param } from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('facturas')
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createFacturaDto: any, @Req() req) {
    return this.facturasService.createFactura(createFacturaDto, req.user.userId);
  }

  @Get('client/:clientId')
  @UseGuards(JwtAuthGuard)
  findByClient(@Param('clientId') clientId: string) {
    return this.facturasService.findByClient(clientId);
  }



  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.facturasService.findAll();
  }
}
