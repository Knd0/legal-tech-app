// Trigger deploy: memory-saving and immediate state-clearing stabilization
import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Logger } from '@nestjs/common';
import { Client, RemoteAuth } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappSession } from './whatsapp-session.entity';
import { WhatsappDbStore } from './whatsapp-db-store';
import { Client as ClientEntity } from '../clients/client.entity';
import { Expediente } from '../expedientes/expediente.entity';
import { Deadline } from '../deadlines/deadline.entity';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import * as path from 'path';
import * as os from 'os';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcodeTerminal = require('qrcode-terminal');

@Injectable()
export class WhatsappService implements OnApplicationBootstrap, OnModuleDestroy {
  private client: Client;
  private readonly logger = new Logger(WhatsappService.name);
  private isReady = false;
  private isInitialized = false;
  private qrCodeImage: string | null = null;
  private initializationError: string | null = null;
  private loadingScreen: { percent: number; message: string } | null = null;
  private initializingPromise: Promise<void> | null = null;
  private restartingPromise: Promise<any> | null = null;

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
      this.logger.log('CLI or Test environment detected. Skipping automatic WhatsApp initialization.');
      return;
    }

    // Check session after database connection is fully established by NestJS bootstrap
    try {
      const session = await this.sessionRepository.findOne({ where: { id: 'session-themis-session' } });
      if (session) {
        this.logger.log('WhatsApp session found in DB. Automatically initializing WhatsApp client in the background...');
        // Run in background without awaiting to prevent blocking the NestJS bootstrap process,
        // which can lead to Gateway Timeout (504) in production platforms like Railway.
        this.ensureInitialized().catch((err) => {
          this.logger.error('Failed to initialize WhatsApp client in background', err);
        });
      } else {
        this.logger.log('No WhatsApp session found in DB. WhatsApp client initialization deferred.');
      }
    } catch (err: any) {
      this.logger.error('Failed to check WhatsApp session on boot', err);
    }
  }

  private async recreateClient() {
    if (this.client) {
      this.logger.log('Recreating WhatsApp client to guarantee clean state...');
      try {
        this.client.removeAllListeners();
        await this.client.destroy();
      } catch (e: any) {
        this.logger.warn('Error destroying client during recreation: ' + e.message);
      }
    }
    this.createClient();
  }

  private createClient() {
    const store = new WhatsappDbStore(this.sessionRepository);
    const headlessVal = process.env.PUPPETEER_HEADLESS !== undefined
      ? (process.env.PUPPETEER_HEADLESS === 'true')
      : (process.platform === 'win32' ? false : 'new');

    // Resolve browser path on Windows to use modern installed Chrome or Edge (preventing deprecation screens)
    let solvedExecutablePath: string | undefined = undefined;
    if (process.platform === 'win32') {
      const fs = require('fs');
      const browserPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ];
      for (const p of browserPaths) {
        if (fs.existsSync(p)) {
          solvedExecutablePath = p;
          break;
        }
      }
    }

    const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || solvedExecutablePath;
    const sessionDir = this.getSessionPath();
    this.logger.log(`Using WhatsApp session directory: ${sessionDir}`);

    this.client = new Client({
      authStrategy: new RemoteAuth({
        clientId: 'themis-session',
        dataPath: sessionDir,
        store: store,
        backupSyncIntervalMs: 60000,
      }),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      authTimeoutMs: 0, // Disable auth timeout to prevent unhandled rejection "auth timeout"
      qrMaxRetries: 10,
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
        strict: false
      },
      puppeteer: {
        headless: headlessVal,
        executablePath: execPath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36', // Fix: Modern custom UA to prevent deprecation screens
            '--disable-application-cache',
            '--disable-gpu-program-cache',
            '--disable-gpu-shader-disk-cache',
            '--disk-cache-size=1',
            '--media-cache-size=1',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--mute-audio'
        ],
        timeout: 60000,
      }
    });

    this.logger.log(`WhatsApp Client Instance Created. Headless=${headlessVal}, ExecutablePath=${execPath || 'Auto-resolve'}`);

    let lastQrLogTime = 0;
    this.client.on('qr', async (qr: string) => {
      const now = Date.now();
      if (now - lastQrLogTime > 120000) {
        this.logger.log('QR Code received from WhatsApp Web (waiting for scan)...');
        lastQrLogTime = now;
      }
      try {
        const url = await QRCode.toDataURL(qr);
        this.qrCodeImage = url;
      } catch (err) {
        this.logger.error('Failed to generate QR image via QRCode lib', err);
      }
    });

    this.client.on('loading_screen', (percent: number, message: string) => {
        this.logger.log(`WhatsApp loading screen: ${percent}% - ${message}`);
        this.loadingScreen = { percent, message };
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.qrCodeImage = null; // Clear QR when connected
      this.loadingScreen = null; // Clear loading screen
      this.logger.log('WhatsApp Client is ready!');
      this.initializationError = null;
    });

    this.client.on('authenticated', () => {
        this.logger.log('WhatsApp Authenticated');
        this.qrCodeImage = null;
    });

    this.client.on('remote-session-saved', () => {
        this.logger.log('WhatsApp Remote Session Saved to database successfully!');
    });

    this.client.on('auth_failure', (msg: string) => {
        this.logger.error('WhatsApp Authentication Failure', msg);
        this.initializationError = `Auth Failure: ${msg}`;
        this.loadingScreen = null;
    });
    
    this.client.on('disconnected', (reason) => {
        this.logger.warn('WhatsApp Client Disconnected', reason);
        this.isReady = false;
        this.qrCodeImage = null;
        this.loadingScreen = null;
    });

    // Chat bidireccional interactivo inhabilitado temporalmente a petición del usuario.
    // Solo se realizarán envíos automáticos de notificaciones salientes.
    /*
    this.client.on('message', async (msg) => {
      try {
        await this.handleIncomingMessage(msg);
      } catch (err) {
        this.logger.error('Error handling incoming WhatsApp message', err);
      }
    });
    */
  }

  private async ensureInitialized(fromRestart = false) {
    if (this.isReady) return;
    if (!fromRestart && this.restartingPromise) {
      return this.restartingPromise;
    }
    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    this.isInitialized = true;
    this.initializationError = null;
    this.logger.log('Initializing WhatsApp Client (launching Puppeteer)...');

    this.initializingPromise = (async () => {
      try {
        // Recreate the client instance to start with a fresh state
        await this.recreateClient();

        // Check session in database. If no session exists, clean up local folder first to ensure a completely clean start.
        const session = await this.sessionRepository.findOne({ where: { id: 'session-themis-session' } });
        const sessionDir = this.getSessionPath();
        if (!session) {
          this.logger.log('No WhatsApp session found in DB. Cleaning up local session folder before initializing to ensure a clean state...');
          const fs = require('fs');
          const sessionPath = path.join(sessionDir, 'RemoteAuth-themis-session');
          if (fs.existsSync(sessionPath)) {
            try {
              fs.rmSync(sessionPath, { recursive: true, force: true });
              this.logger.log('Local session folder cleared.');
            } catch (e: any) {
              this.logger.warn('Could not clear local session folder: ' + e.message);
            }
          }
        }

        // Clear any stale lockfile before launching to prevent Puppeteer "already running" error on Windows
        const fs = require('fs');
        const lockfilePath = path.join(sessionDir, 'RemoteAuth-themis-session', 'lockfile');
        if (fs.existsSync(lockfilePath)) {
          this.logger.log('Stale lockfile detected. Removing lockfile before initializing...');
          try {
            fs.unlinkSync(lockfilePath);
            this.logger.log('Stale lockfile removed.');
          } catch (e: any) {
            this.logger.warn('Could not remove stale lockfile: ' + e.message);
          }
        }

        await this.client.initialize();
      } catch (err: any) {
        this.logger.error('Failed to initialize WhatsApp client', err);
        this.initializationError = err.message || 'Unknown initialization error';
        this.isInitialized = false; // Reset to allow retry
        try {
          this.logger.log('Destroying client to release locks after initialization failure...');
          if (this.client) {
            await this.client.destroy();
          }
        } catch (destroyErr: any) {
          this.logger.warn('Failed to destroy client on initialization failure: ' + destroyErr.message);
        }
        throw err; // Rethrow to reject initializingPromise
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
    if (!this.isInitialized) {
      await this.ensureInitialized();
    }

    if (this.initializationError) {
      throw new Error(`WhatsApp client initialization failed: ${this.initializationError}`);
    }
    if (!this.isInitialized) {
      throw new Error('WhatsApp client is not initialized');
    }
  }

  constructor(
    @InjectRepository(WhatsappSession)
    private readonly sessionRepository: Repository<WhatsappSession>,
    @InjectRepository(ClientEntity)
    private readonly clientRepository: Repository<ClientEntity>,
    @InjectRepository(Expediente)
    private readonly expedienteRepository: Repository<Expediente>,
    @InjectRepository(Deadline)
    private readonly deadlineRepository: Repository<Deadline>,
    @InjectRepository(Movimiento)
    private readonly movimientoRepository: Repository<Movimiento>,
  ) {
    this.createClient();
  }

  async sendMessage(number: string, message: string): Promise<any> {
    await this.waitForInitialization();
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
      await this.waitForInitialization();
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

           // Bypass whatsapp-web.js bug: window.onCodeReceivedEvent is not exposed if pairWithPhoneNumber is not set in constructor
           const page = (this.client as any).pupPage;
           if (page) {
               const hasEvent = await page.evaluate(() => typeof (window as any).onCodeReceivedEvent === 'function');
               if (!hasEvent) {
                   this.logger.log('Exposing window.onCodeReceivedEvent to Puppeteer browser context...');
                   try {
                       await page.exposeFunction('onCodeReceivedEvent', (code: string) => {
                           this.client.emit('code', code);
                           return code;
                       });
                   } catch (e: any) {
                       this.logger.warn('Failed to expose onCodeReceivedEvent (might already be exposed): ' + e.message);
                   }
               }
           }

           const code = await this.client.requestPairingCode(cleanCode);
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
          number: this.isReady ? (this.client.info?.wid?.user || this.client.info?.me?.user) : null,
          loading: this.loadingScreen, // Expose loading status
          error: this.initializationError // Expose error
      };
  }

  async logout() {
      this.logger.log('Logging out WhatsApp client...');
      
      // Clear states and errors immediately to prevent frontend from reading stale values
      this.initializationError = null;
      this.qrCodeImage = null;
      this.loadingScreen = null;
      this.isReady = false;
      this.isInitialized = false;

      try {
          if (this.initializingPromise) {
              this.logger.log('Waiting for active initialization to complete/fail before logging out...');
              try {
                  await this.initializingPromise;
              } catch (e) {}
          }
          if (this.restartingPromise) {
              this.logger.log('Waiting for active restart to complete/fail before logging out...');
              try {
                  await this.restartingPromise;
              } catch (e) {}
          }

          if (this.isReady) {
              await this.client.logout();
          }
          if (this.isInitialized) {
              await this.client.destroy();
          }
          this.isReady = false;
          this.isInitialized = false;
          this.qrCodeImage = null;
          this.logger.log('Client destroyed.');
          
          // Ensure DB session is deleted
          await this.sessionRepository.delete({ id: 'session-themis-session' });
          this.logger.log('Session data cleared from DB.');
          
          return { success: true };
      } catch (error) {
          this.logger.error('Error during logout', error);
          this.isReady = false;
          this.isInitialized = false;
          
          // Ensure DB session is deleted even on error
          await this.sessionRepository.delete({ id: 'session-themis-session' });
          this.logger.log('Session data cleared from DB after error.');
          throw error;
      }
  }

  async restart() {
      if (this.restartingPromise) {
          this.logger.log('Restart already in progress. Returning existing restart status.');
          return { success: true, message: 'Restart already in progress' };
      }

      this.logger.log('Force restarting WhatsApp client (Background Process)...');
      
      // Clear error states, loading screen and ready flags immediately to prevent frontend
      // from reading stale error states during the 5-second restart delay.
      this.initializationError = null;
      this.qrCodeImage = null;
      this.loadingScreen = null;
      this.isReady = false;
      this.isInitialized = false;

      this.restartingPromise = (async () => {
          try {
              // Wait for any active initialization promise to settle first
              if (this.initializingPromise) {
                  this.logger.log('Waiting for active initialization to complete/fail before restarting...');
                  try {
                      await this.initializingPromise;
                  } catch (e) {
                      // ignore initialization errors since we are restarting
                  }
              }

              this.isReady = false;
              this.isInitialized = false;
              this.qrCodeImage = null;

              if (this.client) {
                  this.logger.log('Destroying existing client...');
                  await this.client.destroy().catch(e => this.logger.warn('Error destroying client', e));
              }
              
              // Wait a moment for file locks to release
              await new Promise(resolve => setTimeout(resolve, 5000)); // Increased wait time
              
              const fs = require('fs');
              const sessionDir = this.getSessionPath();
              if (fs.existsSync(sessionDir)) {
                  this.logger.log('Clearing session data...');
                  try {
                    // Try robust removal
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                    this.logger.log('Session data cleared.');
                  } catch(e: any) {
                      this.logger.warn('Could not remove auth folder immediately (likely locked). Proceeding anyway...', e.message);
                  }
              }

              // Do NOT delete from database here to allow local session syncing.
              // If a session exists in the DB, it will be pulled and used on re-initialization.
              this.logger.log('Keeping database session (if any) for recovery.');

              this.initializationError = null;
              
              this.logger.log('Re-initializing client...');
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

  private async handleIncomingMessage(msg: any) {
    // Ignore messages from groups or from status updates
    if (msg.from.endsWith('@g.us') || msg.key?.fromMe) {
      return;
    }

    const cleanIncoming = msg.from.replace(/\D/g, ''); // E.g. "5491123456789"
    if (cleanIncoming.length < 10) return;
    const last10Incoming = cleanIncoming.substring(cleanIncoming.length - 10);

    // Find matching clients using SQL suffix pattern matching to prevent loading all clients in memory.
    const matchingClients = await this.clientRepository.createQueryBuilder('client')
      .where("RIGHT(REGEXP_REPLACE(client.telefono, '[^0-9]', '', 'g'), 10) = :last10", { last10: last10Incoming })
      .getMany();

    if (matchingClients.length === 0) {
      // Not a registered client. Reply with polite help message.
      const welcomeMsg = `¡Hola! Gracias por comunicarte con el *Estudio Jurídico*.
Este número es una línea automatizada para consultas exclusivas de clientes.
Si sos cliente, asegurate de escribir desde el número de teléfono registrado en nuestro sistema.
Si querés realizar una consulta o iniciar una causa, por favor indicanos tu nombre y nos contactaremos a la brevedad. ¡Muchas gracias!`;
      await this.client.sendMessage(msg.from, welcomeMsg);
      return;
    }

    // If more than one client matches (number collision), ask sender to identify themselves
    // instead of exposing data for multiple clients.
    if (matchingClients.length > 1) {
      await this.client.sendMessage(msg.from, '¡Hola! Encontramos más de un cliente con este número. Por favor, indicanos tu nombre completo para identificarte correctamente.');
      return;
    }

    const clientIds = matchingClients.map(c => c.id);
    const clientNames = matchingClients.map(c => `${c.nombre} ${c.apellido}`).join(', ');

    const bodyText = (msg.body || '').trim().toLowerCase();

    // Command menu handler
    if (['hola', 'menu', 'menú', 'ayuda', 'hola!', 'buenas', 'buen día', 'buenas tardes'].includes(bodyText)) {
      const menuMsg = `¡Hola *${clientNames}*! Bienvenido al Asistente Virtual del *Estudio Jurídico (Themis)*.
      
Por favor, respondé con el número de la opción que querés consultar:

*1.* 📂 Consultar el estado de mis expedientes.
*2.* 📅 Ver mis próximas audiencias y compromisos.
*3.* 💰 Ver mi saldo y cuenta corriente.

Escribí *menu* en cualquier momento para volver a ver estas opciones.`;
      await this.client.sendMessage(msg.from, menuMsg);
      return;
    }

    if (bodyText === '1' || bodyText.includes('expediente') || bodyText.includes('estado')) {
      // Fetch expedientes
      const expedientes = await this.expedienteRepository.createQueryBuilder('expediente')
        .where('expediente.clienteId IN (:...clientIds)', { clientIds })
        .getMany();

      if (expedientes.length === 0) {
        await this.client.sendMessage(msg.from, 'No registramos expedientes activos asociados a tu número de teléfono.');
        return;
      }

      let response = `📂 *Tus Expedientes:*`;
      for (const exp of expedientes) {
        response += `\n\n• *Expediente:* ${exp.nroExpediente}
  *Carátula:* ${exp.caratula}
  *Fuero:* ${exp.fuero}
  *Juzgado:* ${exp.juzgado}
  *Estado:* _${exp.estado}_`;
      }
      response += `\n\nEscribí *menu* para volver al menú principal.`;
      await this.client.sendMessage(msg.from, response);
      return;
    }

    if (bodyText === '2' || bodyText.includes('audiencia') || bodyText.includes('compromiso') || bodyText.includes('vencimiento')) {
      // Fetch deadlines (vencimientos / audiencias) for these client's expedientes
      const expedientes = await this.expedienteRepository.createQueryBuilder('expediente')
        .where('expediente.clienteId IN (:...clientIds)', { clientIds })
        .getMany();

      if (expedientes.length === 0) {
        await this.client.sendMessage(msg.from, 'No tenés audiencias o vencimientos próximos programados.');
        return;
      }

      const expIds = expedientes.map(e => e.id);
      const deadlines = await this.deadlineRepository.createQueryBuilder('deadline')
        .where('deadline.expedienteId IN (:...expIds)', { expIds })
        .andWhere('deadline.fechaVencimiento >= :today', { today: new Date().toISOString().split('T')[0] })
        .orderBy('deadline.fechaVencimiento', 'ASC')
        .getMany();

      if (deadlines.length === 0) {
        await this.client.sendMessage(msg.from, 'No tenés audiencias o vencimientos programados para los próximos días.');
        return;
      }

      let response = `📅 *Tus Próximas Audiencias y Vencimientos:*`;
      for (const d of deadlines) {
        const dateParts = new Date(d.fechaVencimiento).toISOString().split('T')[0].split('-');
        const dateFormatted = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        response += `\n\n• *Compromiso:* ${d.titulo}
  *Tipo:* ${d.tipo || 'Audiencia'}
  *Fecha:* ${dateFormatted} a las ${d.horaVencimiento || '00:00'} hs.
  *Detalle:* _${d.descripcion || 'Sin descripción.'}_`;
      }
      response += `\n\nEscribí *menu* para volver al menú principal.`;
      await this.client.sendMessage(msg.from, response);
      return;
    }

    if (bodyText === '3' || bodyText.includes('saldo') || bodyText.includes('movimiento') || bodyText.includes('pago') || bodyText.includes('cuenta')) {
      // Fetch financial movements
      const movements = await this.movimientoRepository.createQueryBuilder('movimiento')
        .where('movimiento.clientId IN (:...clientIds)', { clientIds })
        .orderBy('movimiento.fecha', 'DESC')
        .getMany();

      if (movements.length === 0) {
        await this.client.sendMessage(msg.from, 'No registramos movimientos financieros asociados a tu cuenta.');
        return;
      }

      let totalHonorarios = 0;
      let totalGastos = 0;
      let totalPagado = 0;

      for (const m of movements) {
        const amount = Number(m.monto);
        if (m.tipo === 'HONORARIO') {
          totalHonorarios += amount;
          if (m.estado === 'PAGADO') totalPagado += amount;
        } else if (m.tipo === 'GASTO') {
          totalGastos += amount;
          if (m.estado === 'PAGADO') totalPagado += amount;
        } else if (m.tipo === 'PAGO') {
          totalPagado += amount;
        }
      }

      const totalDeuda = (totalHonorarios + totalGastos) - totalPagado;
      const fmtCurrency = (val: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

      let response = `💰 *Resumen de tu Cuenta Corriente:*
      
• *Honorarios Totales:* ${fmtCurrency(totalHonorarios)}
• *Gastos Totales:* ${fmtCurrency(totalGastos)}
• *Total Pagado / Acreditado:* ${fmtCurrency(totalPagado)}
• *Saldo Pendiente:* *${fmtCurrency(Math.max(0, totalDeuda))}*

*Últimos movimientos:*`;

      const recent = movements.slice(0, 5);
      for (const r of recent) {
        const dateParts = new Date(r.fecha).toISOString().split('T')[0].split('-');
        const dateFormatted = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        response += `\n- [${r.estado}] ${dateFormatted} - ${r.descripcion}: ${fmtCurrency(Number(r.monto))}`;
      }

      response += `\n\nEscribí *menu* para volver al menú principal.`;
      await this.client.sendMessage(msg.from, response);
      return;
    }

    // Default fallback
    const defaultMsg = `No entendí tu consulta. Por favor, seleccioná una de las opciones del menú:

*1.* 📂 Consultar el estado de mis expedientes.
*2.* 📅 Ver mis próximas audiencias y compromisos.
*3.* 💰 Ver mi saldo y cuenta corriente.

Escribí *menu* para ver la lista completa.`;
    await this.client.sendMessage(msg.from, defaultMsg);
  }

  async onModuleDestroy() {
    this.logger.log('Closing WhatsApp client due to module destroy...');
    try {
      if (this.client) {
        await this.client.destroy();
      }
    } catch (err: any) {
      this.logger.error('Error destroying WhatsApp client on module destroy', err);
    }
  }
}
