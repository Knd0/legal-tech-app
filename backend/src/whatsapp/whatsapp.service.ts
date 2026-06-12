import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Logger } from '@nestjs/common';
import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  makeCacheableSignalKeyStore 
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappSession } from './whatsapp-session.entity';
import { WhatsappQueue } from './whatsapp-queue.entity';
import { Client as ClientEntity } from '../clients/client.entity';
import { Expediente } from '../expedientes/expediente.entity';
import { Deadline } from '../deadlines/deadline.entity';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class WhatsappService implements OnApplicationBootstrap, OnModuleDestroy {
  private socket: any = null;
  private readonly logger = new Logger(WhatsappService.name);
  private isReady = false;
  private qrCodeImage: string | null = null;
  private initializationError: string | null = null;
  private loadingScreen: { percent: number; message: string } | null = null;
  private initializingPromise: Promise<void> | null = null;
  private restartingPromise: Promise<any> | null = null;
  private queueInterval: any;

  private getSessionPath(): string {
    const isWindows = process.platform === 'win32';
    // On Windows, resolve a folder in the user's home directory to bypass Chrome sandbox blocks inside hidden .gemini folders.
    // On production (Linux), resolve a standard './whatsapp-auth' absolute path.
    const resolvedPath = isWindows
      ? path.join(os.homedir(), 'themis-whatsapp-auth')
      : path.resolve(process.cwd(), 'whatsapp-auth');
    return resolvedPath;
  }

  async onApplicationBootstrap() {
    this.initializationError = null; 
    
    // Check if running in a CLI command (seeder, migration, test, etc.)
    const isCLI = process.argv.some(arg => 
      arg.includes('seed') || 
      arg.includes('jest') || 
      arg.includes('migration') || 
      arg.includes('schema')
    );
    if (isCLI) {
      this.logger.log('CLI or Test environment detected. Skipping WhatsApp initialization.');
      return;
    }

    this.initializeOnBootWithRetry();
  }

  private async initializeOnBootWithRetry(retries = 5, delayMs = 10000) {
    try {
      const sessionDir = this.getSessionPath();
      
      // Load all files from DB to local folder
      await this.syncDbToLocalFolder(sessionDir);
      
      const fs = require('fs');
      const credsExist = fs.existsSync(path.join(sessionDir, 'creds.json'));
      const isProduction = process.env.NODE_ENV === 'production' || process.platform !== 'win32';
      
      if (!isProduction || credsExist) {
        this.logger.log(`Automatically initializing WhatsApp client (credsExist=${credsExist})...`);
        // Run in background without awaiting to prevent blocking the NestJS bootstrap process
        this.ensureInitialized().catch((err) => {
          this.logger.error('Failed to initialize WhatsApp client in background', err);
        });
      } else {
        this.logger.log('No WhatsApp credentials found in DB. WhatsApp client initialization deferred.');
      }
    } catch (err: any) {
      this.logger.error(`Failed to check WhatsApp session on boot (retries left: ${retries})`, err);
      
      const isDbStartingOrRecovering = 
        err.message?.toLowerCase().includes('starting up') || 
        err.message?.toLowerCase().includes('recovery') || 
        err.message?.toLowerCase().includes('terminated') ||
        err.code === '57P03';

      if (retries > 0 && isDbStartingOrRecovering) {
        this.logger.log(`Database is starting up or in recovery. Retrying in ${delayMs / 1000}s...`);
        setTimeout(() => {
          this.initializeOnBootWithRetry(retries - 1, delayMs);
        }, delayMs);
      }
    }
  }

  private async ensureInitialized(fromRestart = false) {
    if (this.socket && this.isReady) return;
    if (!fromRestart && this.restartingPromise) {
      return this.restartingPromise;
    }
    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    this.initializationError = null;
    this.logger.log('Initializing WhatsApp Client (Baileys)...');

    this.initializingPromise = (async () => {
      try {
        const sessionDir = this.getSessionPath();
        
        // 1. Sync files from DB to local directory first
        await this.syncDbToLocalFolder(sessionDir);
        
        // 2. Load auth state from local folder
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        // 3. Make socket
        const sock = makeWASocket({
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, this.logger as any),
          },
          printQRInTerminal: false,
          browser: ['Themis Legal Tech', 'Chrome', '1.0.0']
        });
        
        this.socket = sock;

        // 4. Handle credential updates
        sock.ev.on('creds.update', async () => {
          await saveCreds();
          await this.syncLocalFolderToDb(sessionDir);
        });

        // 5. Handle connection updates
        sock.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            this.logger.log('New WhatsApp QR code generated.');
            try {
              this.qrCodeImage = await QRCode.toDataURL(qr);
            } catch (err) {
              this.logger.error('Failed to generate QR image via QRCode lib', err);
            }
          }

          if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            this.logger.log(`WhatsApp connection closed. Status code: ${statusCode}, Reconnecting: ${shouldReconnect}`);
            
            this.isReady = false;
            this.qrCodeImage = null;
            this.socket = null;

            if (shouldReconnect) {
              this.logger.log('Attempting reconnection in 5 seconds...');
              setTimeout(() => {
                this.ensureInitialized().catch(err => {
                  this.logger.error('Reconnection attempt failed', err);
                });
              }, 5000);
            } else {
              this.logger.log('Logged out. Cleaning up session...');
              await this.logout();
            }
          } else if (connection === 'open') {
            this.isReady = true;
            this.qrCodeImage = null;
            this.initializationError = null;
            this.logger.log('WhatsApp Client (Baileys) is ready!');
            
            // Start queue processor to send any pending queued messages
            this.startQueueProcessor();
          }
        });

        // 6. Handle incoming messages (chat bidireccional interactivo inhabilitado temporalmente)
        /*
        sock.ev.on('messages.upsert', async (chatUpdate) => {
          try {
            const { messages, type } = chatUpdate;
            if (type === 'notify') {
              for (const msg of messages) {
                await this.handleIncomingMessage(msg);
              }
            }
          } catch (err) {
            this.logger.error('Error handling incoming Baileys messages', err);
          }
        });
        */

      } catch (err: any) {
        this.logger.error('Failed to initialize Baileys client', err);
        this.initializationError = err.message || 'Unknown initialization error';
        throw err;
      } finally {
        this.initializingPromise = null;
      }
    })();

    return this.initializingPromise;
  }

  private async waitForInitialization() {
    if (this.restartingPromise) {
      this.logger.log('Waiting for active restart to complete before proceeding...');
      try {
        await this.restartingPromise;
      } catch (e) {}
    }
    if (this.initializingPromise) {
      this.logger.log('Waiting for active initialization to complete before proceeding...');
      try {
        await this.initializingPromise;
      } catch (e) {}
    }
    if (!this.socket) {
      await this.ensureInitialized();
    }

    if (this.initializationError) {
      throw new Error(`WhatsApp client initialization failed: ${this.initializationError}`);
    }
  }

  constructor(
    @InjectRepository(WhatsappSession)
    private readonly sessionRepository: Repository<WhatsappSession>,
    @InjectRepository(WhatsappQueue)
    private readonly queueRepository: Repository<WhatsappQueue>,
    @InjectRepository(ClientEntity)
    private readonly clientRepository: Repository<ClientEntity>,
    @InjectRepository(Expediente)
    private readonly expedienteRepository: Repository<Expediente>,
    @InjectRepository(Deadline)
    private readonly deadlineRepository: Repository<Deadline>,
    @InjectRepository(Movimiento)
    private readonly movimientoRepository: Repository<Movimiento>,
  ) {}

  async sendMessage(number: string, message: string): Promise<any> {
    if (!this.isReady) {
      this.logger.warn(`WhatsApp client is not ready. Queuing message to ${number} in DB...`);
      const queueItem = this.queueRepository.create({
        number,
        message,
        status: 'pending'
      });
      await this.queueRepository.save(queueItem);
      return { success: true, queued: true, message: 'Message queued for sending when bot is connected' };
    }

    return this.sendMessageDirectly(number, message);
  }

  private async sendMessageDirectly(number: string, message: string): Promise<any> {
    const cleanNumber = number.replace(/\D/g, '');
    const jid = `${cleanNumber}@s.whatsapp.net`;

    try {
        if (!this.socket) {
          throw new Error('WhatsApp socket client not initialized');
        }

        // Check if number exists on WhatsApp using Baileys
        const [result] = await this.socket.onWhatsApp(jid);
        if (!result || !result.exists) {
             this.logger.warn(`Number ${cleanNumber} not registered on WhatsApp`);
             throw new Error('Number not registered on WhatsApp');
        }

        const serializedId = result.jid;
        const response = await this.socket.sendMessage(serializedId, { text: message });
        this.logger.log(`Message sent to ${serializedId}`);
        return response;
    } catch (error: any) {
        this.logger.error(`Error sending message to ${cleanNumber}`, error);
        throw error;
    }
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
      await this.waitForInitialization();
      if (!this.socket) {
          throw new Error('Client not initialized');
      }
      this.logger.log(`Requesting pairing code for ${phoneNumber}`);
      try {
           if (this.isReady) {
               throw new Error('Client is already connected');
           }
           
           const cleanCode = phoneNumber.replace(/\D/g, '');
           const code = await this.socket.requestPairingCode(cleanCode);
           this.logger.log(`Pairing code generated: ${code}`);
           return code;
      } catch (error) {
           this.logger.error('Error requesting pairing code', error);
           throw error;
      }
  }

  getStatus() {
      return {
          ready: this.isReady,
          qr: this.qrCodeImage,
          number: this.isReady ? (this.socket?.user?.id?.split('@')[0]?.split(':')[0]) : null,
          loading: this.loadingScreen,
          error: this.initializationError,
          connecting: !!this.initializingPromise || !!this.restartingPromise || (this.socket && !this.isReady && !this.initializationError)
      };
  }

  async logout() {
      this.logger.log('Logging out WhatsApp client...');
      
      this.initializationError = null;
      this.qrCodeImage = null;
      this.loadingScreen = null;
      this.isReady = false;

      try {
          if (this.initializingPromise) {
              try { await this.initializingPromise; } catch (e) {}
          }
          if (this.restartingPromise) {
              try { await this.restartingPromise; } catch (e) {}
          }

          if (this.socket) {
              try {
                await this.socket.logout();
              } catch (e) {}
              this.socket = null;
          }

          // Delete session from DB
          const dbSessions = await this.sessionRepository.find();
          for (const dbSession of dbSessions) {
            if (dbSession.id.endsWith('.json')) {
              await this.sessionRepository.delete({ id: dbSession.id });
            }
          }
          await this.sessionRepository.delete({ id: 'RemoteAuth-themis-session' });

          // Clear local session folder
          const fs = require('fs');
          const sessionDir = this.getSessionPath();
          if (fs.existsSync(sessionDir)) {
              try {
                fs.rmSync(sessionDir, { recursive: true, force: true });
                this.logger.log('Local session folder cleared.');
              } catch (e: any) {
                this.logger.warn('Could not clear local session folder: ' + e.message);
              }
          }

          return { success: true };
      } catch (error) {
          this.logger.error('Error during logout', error);
          throw error;
      }
  }

  async restart() {
      if (this.restartingPromise) {
          this.logger.log('Restart already in progress. Returning existing restart status.');
          return { success: true, message: 'Restart already in progress' };
      }

      this.logger.log('Force restarting WhatsApp client...');
      
      this.initializationError = null;
      this.qrCodeImage = null;
      this.loadingScreen = null;
      this.isReady = false;

      this.restartingPromise = (async () => {
          try {
              if (this.initializingPromise) {
                  try { await this.initializingPromise; } catch (e) {}
              }

              if (this.socket) {
                  this.isReady = false;
                  try {
                    this.socket.end(new Error('Manual restart'));
                  } catch (e) {}
                  this.socket = null;
              }
              
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              // Clear local session folder to force a completely clean load from DB
              const fs = require('fs');
              const sessionDir = this.getSessionPath();
              if (fs.existsSync(sessionDir)) {
                  try {
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                  } catch(e: any) {}
              }

              await this.ensureInitialized(true);
          } catch (e: any) {
              this.logger.error('Error during background restart', e);
              this.initializationError = e.message || 'Restart failed';
          } finally {
              this.restartingPromise = null;
          }
      })();

      return { success: true, message: 'Restart triggered in background' };
  }

  private async syncDbToLocalFolder(folder: string) {
    try {
      const fs = require('fs');
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }

      const dbSessions = await this.sessionRepository.find();
      let restoredCount = 0;
      
      for (const dbSession of dbSessions) {
        if (dbSession.id.endsWith('.json')) {
          const filePath = path.join(folder, dbSession.id);
          fs.writeFileSync(filePath, dbSession.sessionData);
          restoredCount++;
        }
      }
      this.logger.log(`Restored ${restoredCount} session files from database to local folder.`);
    } catch (err: any) {
      this.logger.error('Failed to sync WhatsApp files from database to local folder', err);
    }
  }

  private async syncLocalFolderToDb(folder: string) {
    try {
      const fs = require('fs');
      if (!fs.existsSync(folder)) return;
      const files = fs.readdirSync(folder);
      
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const filePath = path.join(folder, file);
        const data = fs.readFileSync(filePath);
        
        let session = await this.sessionRepository.findOne({ where: { id: file } });
        if (!session) {
          session = this.sessionRepository.create({ id: file });
        }
        session.sessionData = data;
        session.updatedAt = new Date();
        await this.sessionRepository.save(session);
      }

      const dbSessions = await this.sessionRepository.find();
      for (const dbSession of dbSessions) {
        if (dbSession.id.endsWith('.json') && !jsonFiles.includes(dbSession.id)) {
          await this.sessionRepository.delete({ id: dbSession.id });
        }
      }
    } catch (err: any) {
      this.logger.error('Failed to sync WhatsApp files from local folder to database', err);
    }
  }

  private startQueueProcessor() {
    if (this.queueInterval) return;

    this.logger.log('Starting WhatsApp Queue Processor...');
    this.queueInterval = setInterval(async () => {
      if (!this.isReady || !this.socket) {
        return;
      }

      try {
        const pendingMessages = await this.queueRepository.find({
          where: { status: 'pending' },
          order: { createdAt: 'ASC' },
          take: 5
        });

        for (const msg of pendingMessages) {
          msg.status = 'processing';
          await this.queueRepository.save(msg);

          try {
            this.logger.log(`Processing queued message to ${msg.number}...`);
            await this.sendMessageDirectly(msg.number, msg.message);
            msg.status = 'sent';
            msg.processedAt = new Date();
            await this.queueRepository.save(msg);
            this.logger.log(`Queued message to ${msg.number} sent successfully.`);
          } catch (sendErr: any) {
            this.logger.error(`Failed to send queued message to ${msg.number}`, sendErr);
            msg.status = 'failed';
            msg.error = sendErr.message || 'Unknown send error';
            msg.processedAt = new Date();
            await this.queueRepository.save(msg);
          }
        }
      } catch (err: any) {
        this.logger.error('Error in WhatsApp Queue Processor interval', err);
      }
    }, 5000);
  }

  async onModuleDestroy() {
    this.logger.log('Closing WhatsApp client due to module destroy...');
    if (this.queueInterval) {
      clearInterval(this.queueInterval);
      this.queueInterval = null;
    }
    if (this.socket) {
      try {
        this.socket.end(new Error('Module destroy'));
      } catch (err: any) {
        this.logger.error('Error destroying WhatsApp socket on module destroy', err);
      }
    }
  }
}
