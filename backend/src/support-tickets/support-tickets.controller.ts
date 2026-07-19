import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SupportTicketsService } from './support-tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('support-tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportTicketsController {
  constructor(private readonly supportTicketsService: SupportTicketsService) {}

  @Post()
  async create(
    @Body('asunto') asunto: string,
    @Body('descripcion') descripcion: string,
    @Request() req,
  ) {
    return this.supportTicketsService.create(asunto, descripcion, req.user.userId);
  }

  @Get()
  @Roles('ADMIN')
  async findAll() {
    return this.supportTicketsService.findAll();
  }

  @Patch(':id/resolve')
  @Roles('ADMIN')
  async resolve(@Param('id') id: string) {
    return this.supportTicketsService.resolve(id);
  }
}
