import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
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
    const store = new WhatsappDbStore(this.sessionRepository);
    this.client = new Client({
      authStrategy: new RemoteAuth({
        clientId: 'themis-session',
        dataPath: './whatsapp-auth',
        store: store,
        backupSyncIntervalMs: 60000,
      }),
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

    this.client.on('message', async (msg) => {
      try {
        await this.handleIncomingMessage(msg);
      } catch (err) {
        this.logger.error('Error handling incoming WhatsApp message', err);
      }
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

              // Also delete from database for a clean start!
              await this.sessionRepository.delete({ id: 'RemoteAuth-themis-session' });
              this.logger.log('Session data cleared from DB.');

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

  private async handleIncomingMessage(msg: any) {
    // Ignore messages from groups or from status updates
    if (msg.from.endsWith('@g.us') || msg.key?.fromMe) {
      return;
    }

    const cleanIncoming = msg.from.replace(/\D/g, ''); // E.g. "5491123456789"

    // Find matching clients using strict full-number comparison.
    // WhatsApp sends numbers with country code (e.g. 5491123456789) while the DB may store
    // them without it (e.g. 1123456789). We accept a match only when one number is a suffix
    // of the other AND the overlap is at least 10 digits, preventing false positives across tenants.
    const clients = await this.clientRepository.find();
    const matchingClients = clients.filter(c => {
      if (!c.telefono) return false;
      const cleanDb = c.telefono.replace(/\D/g, '');
      if (cleanDb.length < 10 || cleanIncoming.length < 10) return false;
      return cleanIncoming.endsWith(cleanDb) || cleanDb.endsWith(cleanIncoming);
    });

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
}
