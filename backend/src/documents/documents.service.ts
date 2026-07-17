import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Documento } from './entities/document.entity';
import { CloudinaryService } from './cloudinary.service';
import * as fs from 'fs';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Documento)
    private documentsRepository: Repository<Documento>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(file: any, userId: string, clientId?: string, expedienteId?: string) {
    if (!file) throw new Error('File is required');

    try {
      // Upload to Cloudinary
      const uploadResult = await this.cloudinaryService.uploadFile(file.path);

      // Delete temporary local file
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (err) {
        console.error('Error deleting temporary local file:', err);
      }

      const doc = this.documentsRepository.create({
        filename: uploadResult.public_id, // Store Cloudinary public_id
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: uploadResult.secure_url, // Store Cloudinary secure_url
        userId,
        clientId: clientId || null,
        expedienteId: expedienteId || null
      });

      return await this.documentsRepository.save(doc);
    } catch (error) {
      // Clean up temporary local file in case of upload failure
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (err) {
        console.error('Error deleting temporary local file after upload failure:', err);
      }
      throw error;
    }
  }

  async findAll(userId: string, clientId?: string, expedienteId?: string) {
     const where: any = { userId };
     if (clientId) where.clientId = clientId;
     if (expedienteId) where.expedienteId = expedienteId;

     return this.documentsRepository.find({
         where,
         order: { createdAt: 'DESC' }
     });
  }

  async findOne(id: string, userId: string) {
    const doc = await this.documentsRepository.findOneBy({ id, userId });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    return doc;
  }

  async remove(id: string, userId: string) {
    const doc = await this.findOne(id, userId);

    try {
      const isImage = doc.mimeType.startsWith('image/');
      const resourceType = isImage ? 'image' : 'raw';
      await this.cloudinaryService.deleteFile(doc.filename, resourceType);
    } catch (e) {
        console.error('Error deleting file from Cloudinary:', e);
    }

    return this.documentsRepository.remove(doc);
  }
}
