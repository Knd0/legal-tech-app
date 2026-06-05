import { Controller, Post, Body, Req, UseGuards, Get, Param, Query } from '@nestjs/common';
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
  findByClient(
    @Param('clientId') clientId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.facturasService.findByClient(clientId, pageNum, limitNum);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.facturasService.findAll(pageNum, limitNum);
  }
}
