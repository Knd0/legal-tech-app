import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
    this.logger.log('Cloudinary Service Initialized.');
  }

  async uploadFile(
    filePath: string,
    folder: string = 'themis_documents',
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        filePath,
        {
          folder: folder,
          resource_type: 'auto', // Automatically detects images, PDFs, Word/Excel files, etc.
        },
        (error, result) => {
          if (error) {
            this.logger.error(`Failed to upload file to Cloudinary: ${error.message}`);
            return reject(error);
          }
          resolve(result);
        },
      );
    });
  }

  async deleteFile(publicId: string, resourceType: string = 'image'): Promise<any> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(
        publicId,
        { resource_type: resourceType },
        (error, result) => {
          if (error) {
            this.logger.error(`Failed to delete file from Cloudinary: ${error.message}`);
            return reject(error);
          }
          resolve(result);
        },
      );
    });
  }
}
