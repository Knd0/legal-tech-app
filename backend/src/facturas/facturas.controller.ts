import { Controller, Post, Body, Req, UseGuards, Get, Param, Query, Res } from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Response } from 'express';

@Controller('facturas')
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  @Get(':id/pdf')
  @UseGuards(JwtAuthGuard)
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    try {
      const buffer = await this.facturasService.generateInvoicePdf(id);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Factura_${id}.pdf"`,
        'Content-Length': buffer.length,
      });
      return res.end(buffer);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

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
