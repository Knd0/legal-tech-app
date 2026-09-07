import { Controller, Get, Param, Post, Query, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { JurisprudenciaService } from './jurisprudencia.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BuscarJurisprudenciaDto, IngestarJurisprudenciaDto } from './dto/buscar-jurisprudencia.dto';

@Controller('jurisprudencia')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JurisprudenciaController {
  constructor(private readonly service: JurisprudenciaService) {}

  /**
   * Corpus público compartido: a diferencia del resto de la API, no se filtra
   * por `userId` — ver la nota en `Jurisprudencia`.
   */
  @Get()
  buscar(@Query() query: BuscarJurisprudenciaDto) {
    return this.service.buscar(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const doc = await this.service.findOne(id);
    if (!doc) throw new NotFoundException('Documento de jurisprudencia no encontrado.');
    return doc;
  }

  /**
   * Dispara una tanda de ingesta. Restringido a ADMIN: sale a la red contra
   * SAIJ y escribe en un corpus compartido por todos los estudios.
   */
  @Post('ingestar')
  @Roles('ADMIN')
  ingestar(@Body() body: IngestarJurisprudenciaDto) {
    return this.service.ingestarDesdeSaij(body);
  }
}
