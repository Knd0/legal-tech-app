import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Request, Query } from '@nestjs/common';
import { ExpedientesService } from './expedientes.service';
import { Expediente } from './expediente.entity';
import { Actuacion } from './actuacion.entity';
import { JudicialSyncService } from './judicial-sync.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('expedientes')
@UseGuards(AuthGuard('jwt'))
export class ExpedientesController {
  constructor(
    private readonly expedientesService: ExpedientesService,
    private readonly judicialSyncService: JudicialSyncService,
  ) {}

  @Get()
  findAll(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.expedientesService.findAll(req.user.userId, pageNum, limitNum, search, estado);
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

  @Post(':id/sync')
  sync(@Param('id') id: string) {
    return this.judicialSyncService.syncExpediente(id);
  }

  @Get(':id/actuaciones')
  getActuaciones(@Param('id') id: string, @Request() req) {
    return this.judicialSyncService.getActuaciones(id, req.user.userId);
  }

  @Post(':id/actuaciones')
  createActuacion(@Param('id') id: string, @Body() data: Partial<Actuacion>, @Request() req) {
    return this.judicialSyncService.createManualActuacion(id, data, req.user.userId);
  }

  @Delete(':id/actuaciones/:actuacionId')
  removeActuacion(@Param('id') id: string, @Param('actuacionId') actuacionId: string, @Request() req) {
    return this.judicialSyncService.removeActuacion(actuacionId, id, req.user.userId);
  }
}
