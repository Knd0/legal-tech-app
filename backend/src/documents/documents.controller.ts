import { Controller, Get, Post, Param, Delete, UseInterceptors, UploadedFile, Query, Res, Request, InternalServerErrorException, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@UseGuards(JwtAuthGuard)
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
      }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (req, file, cb) => {
          if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
              cb(null, true);
          } else {
              cb(new BadRequestException('Tipo de archivo no permitido. Solo se aceptan PDF, Word, Excel e imágenes.'), false);
          }
      }
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
