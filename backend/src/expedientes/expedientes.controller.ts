import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Request } from '@nestjs/common';
import { ExpedientesService } from './expedientes.service';
import { Expediente } from './expediente.entity';
import { AuthGuard } from '@nestjs/passport';

@Controller('expedientes')
@UseGuards(AuthGuard('jwt'))
export class ExpedientesController {
  constructor(private readonly expedientesService: ExpedientesService) {}

  @Get()
  findAll(@Request() req) {
    return this.expedientesService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.expedientesService.findOne(id, req.user.userId);
  }

  @Post()
  create(@Body() expediente: Partial<Expediente>, @Request() req) {
    return this.expedientesService.create(expediente, req.user.userId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() expediente: Partial<Expediente>, @Request() req) {
    return this.expedientesService.update(id, expediente, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.expedientesService.remove(id, req.user.userId);
  }
}
