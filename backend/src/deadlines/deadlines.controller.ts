import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Request } from '@nestjs/common';
import { DeadlinesService } from './deadlines.service';
import { Deadline } from './deadline.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('deadlines')
@UseGuards(JwtAuthGuard)
export class DeadlinesController {
  constructor(private readonly deadlinesService: DeadlinesService) {}

  @Get()
  findAll(@Request() req) {
    return this.deadlinesService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.deadlinesService.findOne(id, req.user.userId);
  }

  @Post()
  create(@Body() deadline: Partial<Deadline>, @Request() req) {
    return this.deadlinesService.create(deadline, req.user.userId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() deadline: Partial<Deadline>, @Request() req) {
    return this.deadlinesService.update(id, deadline, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.deadlinesService.remove(id, req.user.userId);
  }
}
