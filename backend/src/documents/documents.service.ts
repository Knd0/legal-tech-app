import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Documento } from './entities/document.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Documento)
    private documentsRepository: Repository<Documento>,
  ) {}

  async create(file: any, clientId?: string, expedienteId?: string) {
    if (!file) throw new Error('File is required');

    const doc = this.documentsRepository.create({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path, 
      clientId: clientId || null,
      expedienteId: expedienteId || null
    });

    return this.documentsRepository.save(doc);
  }

  async findAll(clientId?: string, expedienteId?: string) {
     const where: any = {};
     if (clientId) where.clientId = clientId;
     if (expedienteId) where.expedienteId = expedienteId;
     
     return this.documentsRepository.find({ 
         where,
         order: { createdAt: 'DESC' }
     });
  }

  async findOne(id: string) {
    const doc = await this.documentsRepository.findOneBy({ id });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.findOne(id);
    
    // Delete file from disk
    try {
        if (fs.existsSync(doc.path)) {
            fs.unlinkSync(doc.path);
        }
    } catch (e) {
        console.error('Error deleting file', e);
    }

    return this.documentsRepository.remove(doc);
  }
}
