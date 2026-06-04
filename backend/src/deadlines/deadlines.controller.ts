import { Controller, Get, Post, Body, Param, Delete, Put } from '@nestjs/common';
import { DeadlinesService } from './deadlines.service';
import { Deadline } from './deadline.entity';

@Controller('deadlines')
export class DeadlinesController {
  constructor(private readonly deadlinesService: DeadlinesService) {}

  @Get()
  findAll() {
    return this.deadlinesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deadlinesService.findOne(id);
  }

  @Post()
  create(@Body() deadline: Partial<Deadline>) {
    return this.deadlinesService.create(deadline);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() deadline: Partial<Deadline>) {
    return this.deadlinesService.update(id, deadline);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deadlinesService.remove(id);
  }
}
