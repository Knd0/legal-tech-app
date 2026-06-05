import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { DeadlinesService } from './deadlines.service';
import { Deadline } from './deadline.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@UseGuards(JwtAuthGuard)
@Controller('deadlines')
export class DeadlinesController {
  constructor(private readonly deadlinesService: DeadlinesService) {}

  @Get()
  findAll(@Request() req) {
    return this.deadlinesService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deadlinesService.findOne(id);
  }

  @Post()
  create(@Body() deadline: Partial<Deadline>, @Request() req) {
    deadline.userId = req.user.userId;
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

  @Post('analyze-pdf')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new BadRequestException('Solo se permiten archivos PDF.'), false);
      }
    }
  }))
  analyzePdf(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Archivo PDF no provisto.');
    }
    return this.deadlinesService.analyzePdf(file.buffer);
  }
}
