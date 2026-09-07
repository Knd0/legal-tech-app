import { Controller, Post, Body, Req, UseGuards, Get, Param, Query, Res, NotFoundException } from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Response } from 'express';

@Controller('facturas')
@UseGuards(JwtAuthGuard)
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  @Get(':id/pdf')
  async getPdf(@Param('id') id: string, @Req() req, @Res() res: Response) {
    try {
      const buffer = await this.facturasService.generateInvoicePdf(id, req.user.userId);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Factura_${id}.pdf"`,
        'Content-Length': buffer.length,
      });
      return res.end(buffer);
    } catch (error) {
      const status = error instanceof NotFoundException ? 404 : 500;
      return res.status(status).json({ message: error.message });
    }
  }

  @Post()
  create(@Body() createFacturaDto: any, @Req() req) {
    return this.facturasService.createFactura(createFacturaDto, req.user.userId);
  }

  @Get('client/:clientId')
  findByClient(
    @Param('clientId') clientId: string,
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.facturasService.findByClient(clientId, req.user.userId, pageNum, limitNum);
  }

  @Get()
  findAll(
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.facturasService.findAll(req.user.userId, pageNum, limitNum);
  }
}
