import { Controller, Get, Post, Param, Delete, UseInterceptors, UploadedFile, Query, Res, InternalServerErrorException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import * as fs from 'fs';

@Controller('documents')
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
  create(@UploadedFile() file: any, @Query('clientId') clientId?: string, @Query('expedienteId') expedienteId?: string) {
    if (!file) throw new InternalServerErrorException('No se pudo subir el archivo');
    return this.documentsService.create(file, clientId, expedienteId);
  }

  @Get()
  findAll(@Query('clientId') clientId?: string, @Query('expedienteId') expedienteId?: string) {
    return this.documentsService.findAll(clientId, expedienteId);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: any) {
      const doc = await this.documentsService.findOne(id);
      if (fs.existsSync(doc.path)) {
          return res.download(doc.path, doc.originalName);
      } else {
          throw new InternalServerErrorException('El archivo físico no existe en el servidor');
      }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
