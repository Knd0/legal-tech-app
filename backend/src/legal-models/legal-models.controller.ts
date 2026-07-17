import { Controller, Get, Post, Body, Param, Request, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { LegalModelsService } from './legal-models.service';
import { LegalModel } from './legal-model.entity';
import { AuthGuard } from '@nestjs/passport';

@Controller('legal-models')
@UseGuards(AuthGuard('jwt'))
export class LegalModelsController {
  constructor(private readonly legalModelsService: LegalModelsService) {}

  @Post()
  create(@Body() data: Partial<LegalModel>, @Request() req) {
    return this.legalModelsService.create(data, req.user.userId);
  }

  @Get()
  findAll(
    @Request() req,
    @Query('q') query?: string,
    @Query('fuero') fuero?: string,
    @Query('tipoEscrito') tipoEscrito?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 10;
    return this.legalModelsService.findAll(req.user.userId, query, fuero, tipoEscrito, pageNum, limitNum);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.legalModelsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: Partial<LegalModel>, @Request() req) {
    return this.legalModelsService.update(id, data, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.legalModelsService.remove(id, req.user.userId);
  }
}
