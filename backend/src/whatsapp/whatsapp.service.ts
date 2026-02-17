import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcodeTerminal = require('qrcode-terminal');

@Injectable()
export class WhatsappService implements OnModuleInit {
  private client: Client;
  private readonly logger = new Logger(WhatsappService.name);
  private isReady = false;
  private qrCodeImage: string | null = null;

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: './whatsapp-auth' }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.client.on('qr', (qr: string) => {
      this.logger.log('QR Code received. Generating Data URL...');
      QRCode.toDataURL(qr, (err, url) => {
        if (err) {
            this.logger.error('Failed to generate QR image', err);
            return;
        }
        this.qrCodeImage = url;
      });
      // Still show in terminal for fallback
      qrcodeTerminal.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.qrCodeImage = null; // Clear QR when connected
      this.logger.log('WhatsApp Client is ready!');
    });

    this.client.on('authenticated', () => {
        this.logger.log('WhatsApp Authenticated');
        this.qrCodeImage = null;
    });

    this.client.on('auth_failure', (msg: string) => {
        this.logger.error('WhatsApp Authentication Failure', msg);
    });
  }

  onModuleInit() {
    this.logger.log('Initializing WhatsApp Client...');
    this.client.initialize().catch((err: any) => {
        this.logger.error('Failed to initialize WhatsApp client', err);
    });
  }

  async sendMessage(number: string, message: string): Promise<any> {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready yet');
    }

    // Format number: remove non-digits
    const cleanNumber = number.replace(/\D/g, '');
    
    // We need to resolve the correct ID for the number
    // This handles cases like Argentina (549...) vs other formats
    const sanitized_number = `${cleanNumber}@c.us`;

    try {
        // First try to check if the number is registered
        const numberDetails = await this.client.getNumberId(sanitized_number);
        
        if (!numberDetails) {
             this.logger.warn(`Number ${cleanNumber} not registered on WhatsApp`);
             throw new Error('Number not registered on WhatsApp');
        }

        const serializedId = numberDetails._serialized;
        const response = await this.client.sendMessage(serializedId, message);
        this.logger.log(`Message sent to ${serializedId}`);
        return response;

    } catch (error: any) {
        this.logger.error(`Error sending message to ${cleanNumber}`, error);
        throw error;
    }
  }

  getStatus() {
      return {
          ready: this.isReady,
          qr: this.qrCodeImage
      };
  }

  async logout() {
      this.logger.log('Logging out WhatsApp client...');
      try {
          if (this.isReady) {
              await this.client.logout();
          }
          await this.client.destroy();
          this.isReady = false;
          this.qrCodeImage = null;
          this.logger.log('Client destroyed. Re-initializing...');
          
          // Re-initialize to generate new QR
          this.client.initialize().catch(err => this.logger.error('Failed to re-initialize', err));
          
          return { success: true };
      } catch (error) {
          this.logger.error('Error during logout', error);
          // Force re-init even if logout fails
          this.isReady = false;
          this.client.initialize().catch(err => this.logger.error('Failed to re-initialize', err));
          throw error;
      }
  }
}
