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
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-gpu', 
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--single-process', 
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-extensions',
            '--disable-software-rasterizer',
            '--disable-accelerated-2d-canvas',
            '--disable-gl-drawing-for-tests',
            '--mute-audio'
        ],
        // Allow env override, otherwise let Puppeteer resolve it (undefined)
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined 
      }
    });

    // Log the configuration for debugging
    this.logger.log(`WhatsApp Service Initialized. Puppeteer Config: Headless=${true}, ExecutablePath=${process.env.PUPPETEER_EXECUTABLE_PATH || 'Auto-resolve'}`);

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
    this.initializationError = null; // Clear previous errors
    this.client.initialize().catch((err: any) => {
        this.logger.error('Failed to initialize WhatsApp client', err);
        this.initializationError = err.message || 'Unknown initialization error';
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

  private initializationError: string | null = null;
  // ...

  getStatus() {
      return {
          ready: this.isReady,
          qr: this.qrCodeImage,
          number: this.isReady ? this.client.info?.wid?.user : null,
          error: this.initializationError // Expose error
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

  async restart() {
      this.logger.log('Force restarting WhatsApp client (Background Process)...');
      
      // Run in background to prevent 504 Timeout
      (async () => {
          try {
              if (this.client) {
                await this.client.destroy().catch(e => this.logger.warn('Error destroying client', e));
              }
              
              // Wait a moment for file locks to release
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              const fs = require('fs');
              const path = './whatsapp-auth';
              if (fs.existsSync(path)) {
                  this.logger.log('Clearing session data...');
                  try {
                    fs.rmSync(path, { recursive: true, force: true });
                  } catch(e) {
                      this.logger.warn('Could not remove auth folder', e);
                  }
              }

              this.isReady = false;
              this.qrCodeImage = null;
              this.initializationError = null;
              
              this.logger.log('Re-initializing client...');
              await this.client.initialize();
          } catch (e: any) {
              this.logger.error('Error during background restart', e);
              this.initializationError = e.message || 'Restart failed';
          }
      })();

      return { success: true, message: 'Restart triggered in background' };
  }
}
