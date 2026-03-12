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
  private initializationError: string | null = null; // Fix: Property was missing

  onModuleInit() {
    this.initializationError = null; 
    
    // Delay initialization to prevent blocking NestJS bootstrap on low-resource environments (Render)
    const delay = 8000; // 8 seconds
    this.logger.log(`Scheduling WhatsApp Client initialization in ${delay/1000}s to allow server startup...`);

    setTimeout(() => {
        this.logger.log('Initializing WhatsApp Client now (delayed start)...');
        this.client.initialize().catch((err: any) => {
            this.logger.error('Failed to initialize WhatsApp client', err);
            this.initializationError = err.message || 'Unknown initialization error';
        });
    }, delay);
  }

  constructor() {
    this.client = new Client({
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
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36' // Fix: Custom UA to reduce blocking
        ],
        timeout: 60000,
      }
    });

    // ... (rest of constructor logs)
    this.logger.log(`WhatsApp Service Initialized. Puppeteer Config: Headless=${true}, ExecutablePath=${process.env.PUPPETEER_EXECUTABLE_PATH || 'Auto-resolve'}`);

    this.client.on('qr', async (qr: string) => {
      this.logger.log('QR Code received from WhatsApp Web.');
      try {
        const url = await QRCode.toDataURL(qr);
        this.qrCodeImage = url;
      } catch (err) {
        this.logger.error('Failed to generate QR image via QRCode lib', err);
      }
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.qrCodeImage = null; // Clear QR when connected
      this.logger.log('WhatsApp Client is ready!');
      this.initializationError = null;
    });

    this.client.on('authenticated', () => {
        this.logger.log('WhatsApp Authenticated');
        this.qrCodeImage = null;
    });

    this.client.on('auth_failure', (msg: string) => {
        this.logger.error('WhatsApp Authentication Failure', msg);
        this.initializationError = `Auth Failure: ${msg}`;
    });
    
    this.client.on('disconnected', (reason) => {
        this.logger.warn('WhatsApp Client Disconnected', reason);
        this.isReady = false;
        this.qrCodeImage = null;
    });
  }

  // ... (onModuleInit remains mostly the same, ensuring delay is reasonable)

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

  async requestPairingCode(phoneNumber: string): Promise<string> {
      if (!this.client) {
          throw new Error('Client not initialized');
      }
      this.logger.log(`Requesting pairing code for ${phoneNumber}`);
      try {
          // ensure we are in a state to pair (not ready)
           if (this.isReady) {
               throw new Error('Client is already connected');
           }
           
           // Format: 54911...
           const cleanCode = phoneNumber.replace(/\D/g, '');
           const code = await this.client.requestPairingCode(cleanCode);
           this.logger.log(`Pairing code generated: ${code}`);
           return code;
      } catch (error) {
           this.logger.error('Error requesting pairing code', error);
           throw error;
      }
  }

  getStatus() {
      // Debug log (can be verbose, but useful here)
      // this.logger.debug(`getStatus called. Ready: ${this.isReady}, QR present: ${!!this.qrCodeImage}`);
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
              this.isReady = false;
              this.qrCodeImage = null;

              if (this.client) {
                  this.logger.log('Destroying existing client...');
                  await this.client.destroy().catch(e => this.logger.warn('Error destroying client', e));
              }
              
              // Wait a moment for file locks to release
              await new Promise(resolve => setTimeout(resolve, 3000)); // Increased wait time
              
              const fs = require('fs');
              const path = './whatsapp-auth';
              if (fs.existsSync(path)) {
                  this.logger.log('Clearing session data...');
                  try {
                    // Try robust removal
                    fs.rmSync(path, { recursive: true, force: true });
                    this.logger.log('Session data cleared.');
                  } catch(e: any) {
                      this.logger.warn('Could not remove auth folder immediately (likely locked). Proceeding anyway...', e.message);
                      // In Render, ephemeral storage might be weird. failing to delete shouldn't block restart if possible.
                  }
              }

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
