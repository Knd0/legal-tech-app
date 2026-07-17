import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private client: Client | null = null;
  private readonly logger = new Logger(WhatsappService.name);
  private isReady = false;
  private qrCodeImage: string | null = null;
  private pairingCode: string | null = null;
  private initializationError: string | null = null;

  onModuleInit() {
    this.initializationError = null; 
    
    // Delay initialization to prevent blocking NestJS bootstrap on low-resource environments (Render)
    const delay = 8000; // 8 seconds
    this.logger.log(`Scheduling WhatsApp Client initialization in ${delay/1000}s to allow server startup...`);

    setTimeout(() => {
        const botNumber = process.env.WHATSAPP_BOT_NUMBER;
        if (botNumber) {
            this.logger.log(`Initializing WhatsApp Client now (delayed start) with WHATSAPP_BOT_NUMBER environment variable: ${botNumber}...`);
            this.initializeClient(botNumber.replace(/\D/g, ''));
        } else {
            this.logger.log('Initializing WhatsApp Client now (delayed start in QR mode)...');
            this.initializeClient();
        }
    }, delay);
  }


  private initializeClient(phoneNumber?: string) {
    this.logger.log(`Creating WhatsApp Client instance. PhoneNumber for pairing: ${phoneNumber || 'None (QR Mode)'}`);
    
    const clientOptions: any = {
      authStrategy: new LocalAuth({ dataPath: './whatsapp-auth' }),
      authTimeoutMs: 0, // Disable auth timeout to prevent unhandled rejection "auth timeout"
      qrMaxRetries: 10,
      puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        ],
        timeout: 60000,
      }
    };

    if (phoneNumber) {
      clientOptions.pairWithPhoneNumber = {
        phoneNumber: phoneNumber
      };
    }

    this.client = new Client(clientOptions);

    this.client.on('qr', async (qr: string) => {
      this.logger.log('QR Code received from WhatsApp Web.');
      this.pairingCode = null;
      try {
        const url = await QRCode.toDataURL(qr);
        this.qrCodeImage = url;
      } catch (err) {
        this.logger.error('Failed to generate QR image via QRCode lib', err);
      }
    });

    this.client.on('pairing_code', (code: string) => {
      this.logger.log(`Pairing code received from WhatsApp Web: ${code}`);
      this.pairingCode = code;
      this.qrCodeImage = null;
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.qrCodeImage = null;
      this.pairingCode = null;
      this.logger.log('WhatsApp Client is ready!');
      this.initializationError = null;
    });

    this.client.on('authenticated', () => {
        this.logger.log('WhatsApp Authenticated');
        this.qrCodeImage = null;
        this.pairingCode = null;
    });

    this.client.on('auth_failure', (msg: string) => {
        this.logger.error('WhatsApp Authentication Failure', msg);
        this.initializationError = `Auth Failure: ${msg}`;
    });
    
    this.client.on('disconnected', (reason) => {
        this.logger.warn('WhatsApp Client Disconnected', reason);
        this.isReady = false;
        this.qrCodeImage = null;
        this.pairingCode = null;
    });

    this.client.initialize().catch((err: any) => {
        this.logger.error('Failed to initialize WhatsApp client', err);
        this.initializationError = err.message || 'Unknown initialization error';
    });
  }

  async sendMessage(number: string, message: string): Promise<any> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client is not ready yet');
    }

    // Format number: remove non-digits
    const cleanNumber = number.replace(/\D/g, '');
    const sanitized_number = `${cleanNumber}@c.us`;

    try {
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

  async requestPairingCode(phoneNumber: string): Promise<string> {
      if (this.isReady) {
          throw new Error('Client is already connected');
      }
      
      const cleanCode = phoneNumber.replace(/\D/g, '');
      this.logger.log(`Requesting pairing code dynamically for ${cleanCode}`);

      try {
          if (this.client) {
              this.logger.log('Destroying existing client for pairing code re-initialization...');
              await this.client.destroy().catch(e => this.logger.warn('Error destroying client', e));
          }

          this.isReady = false;
          this.qrCodeImage = null;
          this.pairingCode = null;
          this.initializationError = null;

          // Re-initialize client in pairing code mode
          this.initializeClient(cleanCode);

          // Active wait for the pairing code event to fire (up to 20 seconds)
          const start = Date.now();
          while (!this.pairingCode && Date.now() - start < 20000) {
              if (this.initializationError) {
                  throw new Error(this.initializationError);
              }
              await new Promise(resolve => setTimeout(resolve, 500));
          }

          if (!this.pairingCode) {
              throw new Error('Timeout waiting for pairing code generation');
          }

          return this.pairingCode;
      } catch (error) {
           this.logger.error('Error requesting pairing code', error);
           throw error;
      }
  }

  getStatus() {
      return {
          ready: this.isReady,
          qr: this.qrCodeImage,
          pairingCode: this.pairingCode,
          number: (this.isReady && this.client) ? this.client.info?.wid?.user : null,
          error: this.initializationError
      };
  }

  async logout() {
      this.logger.log('Logging out WhatsApp client...');
      try {
          if (this.client && this.isReady) {
              await this.client.logout();
          }
          if (this.client) {
              await this.client.destroy();
          }
          this.isReady = false;
          this.qrCodeImage = null;
          this.pairingCode = null;
          this.logger.log('Client destroyed. Re-initializing in QR mode...');
          
          this.initializeClient();
          return { success: true };
      } catch (error) {
          this.logger.error('Error during logout', error);
          this.isReady = false;
          this.qrCodeImage = null;
          this.pairingCode = null;
          this.initializeClient();
          throw error;
      }
  }

  async restart() {
      this.logger.log('Force restarting WhatsApp client (Background Process)...');
      
      (async () => {
          try {
              this.isReady = false;
              this.qrCodeImage = null;
              this.pairingCode = null;

              if (this.client) {
                  this.logger.log('Destroying existing client...');
                  await this.client.destroy().catch(e => this.logger.warn('Error destroying client', e));
              }
              
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              const fs = require('fs');
              const path = './whatsapp-auth';
              if (fs.existsSync(path)) {
                  this.logger.log('Clearing session data...');
                  try {
                    fs.rmSync(path, { recursive: true, force: true });
                    this.logger.log('Session data cleared.');
                  } catch(e: any) {
                      this.logger.warn('Could not remove auth folder immediately (likely locked).', e.message);
                  }
              }

              this.initializationError = null;
              
              this.logger.log('Re-initializing client in QR mode...');
              this.initializeClient();
          } catch (e: any) {
              this.logger.error('Error during background restart', e);
              this.initializationError = e.message || 'Restart failed';
          }
      })();

      return { success: true, message: 'Restart triggered in background' };
  }
}

