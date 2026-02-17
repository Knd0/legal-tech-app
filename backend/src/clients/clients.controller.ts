import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Request } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { Client } from './client.entity';
import { AuthGuard } from '@nestjs/passport';

@Controller('clients')
@UseGuards(AuthGuard('jwt'))
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(@Request() req) {
    return this.clientsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.clientsService.findOne(id, req.user.userId);
  }

  @Post()
  create(@Body() client: Partial<Client>, @Request() req) {
    return this.clientsService.create(client, req.user.userId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() client: Partial<Client>, @Request() req) {
    return this.clientsService.update(id, client, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.clientsService.remove(id, req.user.userId);
  }
}
