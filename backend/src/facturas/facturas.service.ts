import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Factura } from './entities/factura.entity';
import { Client } from '../clients/client.entity';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Resend } from 'resend';
import PDFDocument from 'pdfkit';

@Injectable()
export class FacturasService {
  private afip: any;
  private afipClients = new Map<string, any>();
  private resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  constructor(
    @InjectRepository(Factura)
    private facturasRepository: Repository<Factura>,
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
    private configService: ConfigService,
    private usersService: UsersService,
    private whatsappService: WhatsappService,
  ) {
    if (process.env.RESEND_API_KEY) {
      console.log('Resend Email Service Initialized.');
    } else {
      console.warn('RESEND_API_KEY not configured. Email invoice sending is disabled.');
    }
    // Initialize global system AFIP SDK as fallback
    try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const Afip = require('@afipsdk/afip.js');
        
        // Prepare Cert paths
        let certPath = path.resolve('./cert.crt');
        let keyPath = path.resolve('./cert.key');

        // PRODUCTION: Write certs from ENV to temp files
        const envCert = this.configService.get('AFIP_CERT');
        const envKey = this.configService.get('AFIP_KEY');

        console.log(`[DEBUG] AFIP_CERT present: ${!!envCert}, Length: ${envCert ? envCert.length : 0}`);
        console.log(`[DEBUG] AFIP_KEY present: ${!!envKey}, Length: ${envKey ? envKey.length : 0}`);

        if (envCert && envKey) {
            // Private directory per-process prevents symlink attacks and cross-process file reuse
            const secureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'afip-global-'));
            fs.chmodSync(secureDir, 0o700);

            const tmpCertPath = path.join(secureDir, 'cert.crt');
            const tmpKeyPath = path.join(secureDir, 'cert.key');

            // O_EXCL ensures we never follow a pre-existing file or symlink
            const certFd = fs.openSync(tmpCertPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
            fs.writeSync(certFd, envCert); fs.closeSync(certFd);
            const keyFd = fs.openSync(tmpKeyPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
            fs.writeSync(keyFd, envKey); fs.closeSync(keyFd);

            certPath = tmpCertPath;
            keyPath = tmpKeyPath;
            console.log('Global AFIP Certs loaded from ENV and written to temp:', certPath);

            const isProduction = this.configService.get('AFIP_PRODUCTION') === 'true';

            this.afip = new Afip({
                CUIT: this.configService.get('AFIP_CUIT'),
                cert: certPath,
                key: keyPath,
                production: isProduction,
                res_folder: path.dirname(certPath) // Force using the same dir as certs
            });
            
            console.log('Global AFIP Service Initialized with res_folder:', path.dirname(certPath));
        } else {
             console.log('Global AFIP Certs not provided. Global AFIP client disabled (will use user certs or simulation mode).');
             this.afip = null;
        }

    } catch (e: any) {
        console.warn('Global AFIP SDK not initialized (Missing certs or dependency):', e.message);
        this.afip = null;
    }
  }

  async getAfipInstanceForUser(userId: string): Promise<any> {
    if (this.afipClients.has(userId)) {
      return this.afipClients.get(userId);
    }

    const user = await this.usersService.findOneById(userId);
    if (!user || !user.cuit || !user.afipCert || !user.afipKey) {
      return null; // Fallback to global or simulation mode
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const Afip = require('@afipsdk/afip.js');

      // Private directory per-user prevents symlink attacks and cross-process file reuse
      const secureDir = fs.mkdtempSync(path.join(os.tmpdir(), `afip-${userId}-`));
      fs.chmodSync(secureDir, 0o700);

      const certPath = path.join(secureDir, 'cert.crt');
      const keyPath = path.join(secureDir, 'cert.key');

      // O_EXCL ensures we never follow a pre-existing file or symlink
      const certFd = fs.openSync(certPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
      fs.writeSync(certFd, user.afipCert); fs.closeSync(certFd);
      const keyFd = fs.openSync(keyPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
      fs.writeSync(keyFd, user.afipKey); fs.closeSync(keyFd);

      const client = new Afip({
        CUIT: user.cuit.replace(/\D/g, ''), // Ensure no dashes or spaces
        cert: certPath,
        key: keyPath,
        production: user.afipProduction || false,
        res_folder: secureDir
      });

      this.afipClients.set(userId, client);
      return client;
    } catch (e: any) {
      console.error(`Failed to initialize AFIP client for user ${userId}:`, e.message);
      return null;
    }
  }

  async createFactura(data: any, userId: string) {
    const user = await this.usersService.findOneById(userId);
    const puntoVenta = (user && user.puntoVenta) ? user.puntoVenta : 1;

    // Retrieve client to use proper DocTipo & DocNro
    const client = await this.clientsRepository.findOne({ where: { id: data.clientId } });
    let docTipo = 99;
    let docNro = 0;
    if (client) {
      if (client.cuit) {
        docTipo = 80;
        docNro = parseInt(client.cuit.replace(/\D/g, ''), 10) || 0;
      } else if (client.dni) {
        docTipo = 96;
        docNro = parseInt(client.dni.replace(/\D/g, ''), 10) || 0;
      }
    }

    // Get the dynamic AFIP instance for this user
    const afipClient = await this.getAfipInstanceForUser(userId);
    
    // Fall back to global system AFIP if user-level config is missing
    const activeAfip = afipClient || this.afip;

    // SIMULATION MODE if AFIP is not configured
    if (!activeAfip) {
        console.warn('AFIP Service not configured. Using SIMULATION MODE.');
        
        const mockFactura = this.facturasRepository.create({
            puntoVenta: puntoVenta,
            tipoCbte: 11, // Factura C
            nroCbte: Math.floor(Math.random() * 10000),
            fechaCbte: new Date().toISOString().split('T')[0], // YYYY-MM-DD (No replace!)
            impTotal: Math.abs(data.total || 0),
            cae: 'SIMULATED_CAE_' + Math.floor(Math.random() * 10000000000000),
            vtoCae: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // YYYY-MM-DD (No replace!)
            docNro: docNro,
            clientId: data.clientId,
            userId: userId
        } as unknown as Factura);

        const saved = await this.facturasRepository.save(mockFactura);
        
        // Auto-send in background
        this.sendFacturaToClient(saved.id).catch((err) => {
          console.error('Failed to auto-send simulated invoice:', err);
        });

        return saved;
    }

    const date = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const totalAmount = Math.abs(parseFloat(data.total));

    let payload = {
        'CantReg': 1, // Cantidad de comprobantes a registrar
        'PtoVta': puntoVenta, // Punto de venta
        'CbteTipo': 11, // Tipo de comprobante (11 = Factura C) 
        'Concepto': 2, // Concepto del Comprobante: (2) Servicios
        'DocTipo': docTipo, // Tipo de documento del comprador (80 CUIT, 96 DNI, 99 consumidor final)
        'DocNro': docNro, // Numero de documento del comprador
        'CbteDesde': 1, 
        'CbteHasta': 1, 
        'CbteFch': parseInt(date.replace(/-/g, '')), // (Opcional) Fecha del comprobante (yyyymmdd)
        'ImpTotal': totalAmount, // Importe total del comprobante
        'ImpTotConc': 0, // Importe neto no gravado
        'ImpNeto': totalAmount, // Importe neto gravado
        'ImpOpEx': 0, // Importe exento
        'ImpIVA': 0, // Importe total de IVA
        'ImpTrib': 0, //Importe total de tributos
        'MonId': 'PES', //Tipo de moneda usada en el comprobante 
        'MonCotiz': 1, // Cotización de la moneda usada (1 para pesos)
    };

    // If Concepto is Services (2), we must include service dates
    if (payload.Concepto === 2) {
      const fchDesde = parseInt(date.replace(/-/g, ''));
      const fchHasta = parseInt(date.replace(/-/g, ''));
      const fchVtoPago = parseInt(date.replace(/-/g, ''));
      payload['FchServDesde'] = fchDesde;
      payload['FchServHasta'] = fchHasta;
      payload['FchVtoPago'] = fchVtoPago;
    }

    try {
        // Retrieve Last Voucher to set CbteDesde/Hasta correctly using user's configured puntoVenta
        const lastVoucher = await activeAfip.ElectronicBilling.getLastVoucher(puntoVenta, 11);
        payload['CbteDesde'] = lastVoucher + 1;
        payload['CbteHasta'] = lastVoucher + 1;

        const res = await activeAfip.ElectronicBilling.createVoucher(payload);
        
        const formatAfipDate = (str: string | number | null | undefined) => {
          if (!str) return null;
          const s = str.toString().replace(/\D/g, '');
          if (s.length !== 8) return s;
          return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
        };

        // Save to DB
        const factura = this.facturasRepository.create({
            puntoVenta: payload.PtoVta,
            tipoCbte: payload.CbteTipo,
            nroCbte: payload['CbteDesde'],
            fechaCbte: formatAfipDate(payload.CbteFch),
            impTotal: payload.ImpTotal,
            cae: res.CAE,
            vtoCae: formatAfipDate(res.CAEFchVto),
            docNro: payload.DocNro,
            clientId: data.clientId,
            userId: userId
        } as unknown as Factura);

        const saved = await this.facturasRepository.save(factura);

        // Auto-send in background
        this.sendFacturaToClient(saved.id).catch((err) => {
          console.error('Failed to auto-send real invoice:', err);
        });

        return saved;

    } catch (error: any) {
        console.error('Error AFIP', error);
        throw new BadRequestException('Error creating invoice with AFIP: ' + error.message);
    }
  }

  async findAll(page?: number, limit?: number): Promise<any> {
    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      const take = limit;

      const [data, total] = await this.facturasRepository.findAndCount({
        order: { createdAt: 'DESC' },
        skip,
        take,
      });

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    return this.facturasRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findByClient(clientId: string, page?: number, limit?: number): Promise<any> {
    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      const take = limit;

      const [data, total] = await this.facturasRepository.findAndCount({
        where: { clientId },
        order: { createdAt: 'DESC' },
        skip,
        take,
      });

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    return this.facturasRepository.find({
      where: { clientId },
      order: { createdAt: 'DESC' }
    });
  }

  async generateInvoicePdf(facturaId: string): Promise<Buffer> {
    const factura = await this.facturasRepository.findOne({
      where: { id: facturaId },
      relations: ['client', 'user']
    });
    if (!factura) throw new Error('Factura not found');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Design invoice PDF with "Organic" themed colors
      // Header banner / Logo
      doc.fillColor('#2B2521').fontSize(22).font('Helvetica-Bold').text('ESTUDIO JURÍDICO', 50, 50);
      
      // Lawyer details
      doc.fontSize(10).font('Helvetica').fillColor('#555555')
         .text(`Abogado/a: ${factura.user?.fullName || 'Profesional'}`, 50, 80)
         .text(`CUIT: ${factura.user?.cuit || '-'}`, 50, 95)
         .text(`Domicilio: ${factura.user?.address || '-'}`, 50, 110)
         .text(`Condición IVA: ${factura.user?.condicionIva || 'Responsable Monotributo'}`, 50, 125);

      // Invoice box
      doc.rect(380, 50, 165, 95).strokeColor('#C66B3D').lineWidth(2).stroke();
      doc.fillColor('#C66B3D').fontSize(16).font('Helvetica-Bold').text('FACTURA', 380, 60, { align: 'center', width: 165 });
      
      // Big letter C
      doc.rect(450, 80, 25, 25).strokeColor('#C66B3D').lineWidth(1).stroke();
      doc.fillColor('#2B2521').fontSize(16).text('C', 450, 84, { align: 'center', width: 25 });

      const formattedNro = String(factura.nroCbte).padStart(8, '0');
      const formattedPto = String(factura.puntoVenta).padStart(4, '0');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2B2521')
         .text(`N° ${formattedPto}-${formattedNro}`, 380, 115, { align: 'center', width: 165 });
      
      const formattedDate = new Date(factura.createdAt).toLocaleDateString('es-AR');
      doc.font('Helvetica').fontSize(9)
         .text(`Fecha: ${formattedDate}`, 380, 132, { align: 'center', width: 165 });

      // Client section
      doc.moveTo(50, 165).lineTo(545, 165).strokeColor('#E2E8F0').lineWidth(1).stroke();
      
      doc.fillColor('#C66B3D').fontSize(11).font('Helvetica-Bold').text('DATOS DEL CLIENTE', 50, 180);
      
      doc.fontSize(10).font('Helvetica').fillColor('#333333')
         .text(`Nombre/Razón Social: ${factura.client?.nombre || ''} ${factura.client?.apellido || ''}`, 50, 200)
         .text(`DNI/CUIT: ${factura.client?.dni || factura.client?.cuit || '-'}`, 50, 215)
         .text(`Domicilio: ${factura.client?.domicilio || '-'}`, 50, 230)
         .text(`Condición IVA: Consumidor Final`, 350, 200);

      // Items table
      doc.moveTo(50, 260).lineTo(545, 260).strokeColor('#C66B3D').lineWidth(1.5).stroke();
      
      // Table headers
      doc.fillColor('#2B2521').font('Helvetica-Bold')
         .text('Cant.', 50, 270)
         .text('Descripción / Concepto', 100, 270)
         .text('Precio Unit.', 380, 270, { width: 80, align: 'right' })
         .text('Importe', 465, 270, { width: 80, align: 'right' });

      doc.moveTo(50, 285).lineTo(545, 285).strokeColor('#E2E8F0').lineWidth(1).stroke();

      // Table row
      const numTotal = Number(factura.impTotal);
      doc.font('Helvetica').fillColor('#333333')
         .text('1', 50, 295)
         .text('Honorarios Profesionales / Gastos Jurídicos', 100, 295, { width: 270 })
         .text(`$${numTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 380, 295, { width: 80, align: 'right' })
         .text(`$${numTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 465, 295, { width: 80, align: 'right' });

      doc.moveTo(50, 325).lineTo(545, 325).strokeColor('#E2E8F0').lineWidth(1).stroke();

      // Totals
      doc.fillColor('#2B2521').font('Helvetica-Bold').fontSize(12)
         .text(`TOTAL: $${numTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 380, 345, { width: 165, align: 'right' });

      // CAE footer
      doc.rect(50, 420, 495, 60).fillColor('#FAF6F0').fillAndStroke('#E8DCC7');
      doc.fillColor('#2B2521').fontSize(10).font('Helvetica-Bold').text(`CAE: ${factura.cae || 'Simulado'}`, 65, 435);
      
      const caeDateStr = factura.vtoCae || '';
      let formattedCaeVto = '-';
      if (caeDateStr.length === 8) {
        formattedCaeVto = caeDateStr.substring(6,8) + '/' + caeDateStr.substring(4,6) + '/' + caeDateStr.substring(0,4);
      } else {
        formattedCaeVto = new Date(caeDateStr).toLocaleDateString('es-AR');
      }
      doc.font('Helvetica').text(`Vencimiento CAE: ${formattedCaeVto}`, 65, 455);

      // Footer notice
      doc.fontSize(8).fillColor('#888888').text('Comprobante autorizado por la Administración Federal de Ingresos Públicos (AFIP) / ARCA.', 50, 520, { align: 'center', width: 495 });

      doc.end();
    });
  }

  async sendFacturaToClient(facturaId: string): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
    const factura = await this.facturasRepository.findOne({
      where: { id: facturaId },
      relations: ['client', 'user']
    });
    if (!factura) throw new Error('Factura not found');

    const pdfBuffer = await this.generateInvoicePdf(factura.id);
    const fileName = `Factura_${factura.puntoVenta}_${factura.nroCbte}.pdf`;

    let emailSent = false;
    let whatsappSent = false;

    // 1. Send Email via Resend
    if (factura.client?.email && this.resend) {
      try {
        await this.resend.emails.send({
          from: 'Themis Legal Tech <onboarding@resend.dev>',
          to: factura.client.email,
          subject: `Factura de Honorarios - ${factura.user?.fullName || 'Estudio Jurídico'}`,
          html: `<p>Estimado/a ${factura.client.nombre},</p>
                 <p>Le adjuntamos la factura correspondiente a los servicios jurídicos prestados por un monto de <strong>$${Number(factura.impTotal).toLocaleString('es-AR')}</strong>.</p>
                 <p>Atentamente,<br><strong>${factura.user?.fullName || 'Estudio Jurídico'}</strong></p>`,
          attachments: [
            {
              filename: fileName,
              content: pdfBuffer,
            }
          ]
        });
        emailSent = true;
        console.log(`Invoice email sent to client ${factura.client.email}`);
      } catch (error) {
        console.error('Error sending invoice email via Resend:', error);
      }
    }

    // 2. Send WhatsApp via Baileys
    if (factura.client?.telefono) {
      try {
        const caption = `Estimado/a ${factura.client.nombre}, le enviamos la factura correspondiente a los servicios prestados por un monto de $${Number(factura.impTotal).toLocaleString('es-AR')}.`;
        await this.whatsappService.sendDocument(factura.client.telefono, pdfBuffer, fileName, caption);
        whatsappSent = true;
        console.log(`Invoice WhatsApp sent to client ${factura.client.telefono}`);
      } catch (error) {
        console.error('Error sending invoice WhatsApp:', error);
      }
    }

    return { emailSent, whatsappSent };
  }
}
