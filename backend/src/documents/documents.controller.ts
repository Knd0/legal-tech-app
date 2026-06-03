import { Controller, Get, Post, Param, Delete, UseInterceptors, UploadedFile, Query, Res, InternalServerErrorException, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
      storage: diskStorage({
          destination: './uploads',
          filename: (req, file, cb) => {
              const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
              return cb(null, `${randomName}${extname(file.originalname)}`);
          }
      })
  }))
  create(@UploadedFile() file: any, @Request() req, @Query('clientId') clientId?: string, @Query('expedienteId') expedienteId?: string) {
    if (!file) throw new InternalServerErrorException('No se pudo subir el archivo');
    return this.documentsService.create(file, req.user.userId, clientId, expedienteId);
  }

  @Get()
  findAll(@Request() req, @Query('clientId') clientId?: string, @Query('expedienteId') expedienteId?: string) {
    return this.documentsService.findAll(req.user.userId, clientId, expedienteId);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Request() req, @Res() res: any) {
      const doc = await this.documentsService.findOne(id, req.user.userId);
      if (fs.existsSync(doc.path)) {
          return res.download(doc.path, doc.originalName);
      } else {
          throw new InternalServerErrorException('El archivo físico no existe en el servidor');
      }
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.documentsService.remove(id, req.user.userId);
  }
}
