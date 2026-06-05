import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Factura } from './entities/factura.entity';
import { ConfigService } from '@nestjs/config';
// const Afip = require('afip.js'); // Use require for afip.js

@Injectable()
export class FacturasService {
  private afip: any;

  constructor(
    @InjectRepository(Factura)
    private facturasRepository: Repository<Factura>,
    private configService: ConfigService
  ) {
    // Initialize AFIP SDK
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
            const tmpDir = os.tmpdir(); // Cross-platform temp dir (Windows dev/Linux prod)
            // Ensure temp dir exists (it should)
            if (!fs.existsSync(tmpDir)) {
                 try { fs.mkdirSync(tmpDir); } catch(e) {}
            }
            
            const tmpCertPath = path.join(tmpDir, 'cert.crt');
            const tmpKeyPath = path.join(tmpDir, 'cert.key');

            // Write files
            fs.writeFileSync(tmpCertPath, envCert);
            fs.writeFileSync(tmpKeyPath, envKey);

            certPath = tmpCertPath;
            keyPath = tmpKeyPath;
            console.log('AFIP Certs loaded from ENV and written to temp:', certPath);
        } else {
             console.log('AFIP Certs using local files (Dev mode):', certPath);
        }

        const isProduction = this.configService.get('AFIP_PRODUCTION') === 'true';

        this.afip = new Afip({
            CUIT: this.configService.get('AFIP_CUIT'),
            cert: certPath,
            key: keyPath,
            production: isProduction,
            res_folder: path.dirname(certPath) // Force using the same dir as certs
        });
        
        console.log('AFIP Service Initialized with res_folder:', path.dirname(certPath));

    } catch (e) {
        console.warn('AFIP SDK not initialized (Missing certs or dependecy):', e.message);
    }
  }

  async createFactura(data: any, userId: string) {
    // SIMULATION MODE if AFIP is not configured
    if (!this.afip) {
        console.warn('AFIP Service not configured. Using SIMULATION MODE.');
        
        const mockFactura = this.facturasRepository.create({
            puntoVenta: 1,
            tipoCbte: 11, // Factura C
            nroCbte: Math.floor(Math.random() * 10000),
            fechaCbte: new Date().toISOString().split('T')[0].replace(/-/g, ''), // YYYYMMDD
            impTotal: data.total || 0,
            cae: 'SIMULATED_CAE_' + Math.floor(Math.random() * 10000000000000),
            vtoCae: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, ''), // YYYYMMDD
            docNro: 0,
            clientId: data.clientId,
            userId: userId
        } as unknown as Factura);

        return await this.facturasRepository.save(mockFactura);
    }

    const date = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const totalAmount = parseFloat(data.total);

    let payload = {
        'CantReg': 1, // Cantidad de comprobantes a registrar
        'PtoVta': 1, // Punto de venta
        'CbteTipo': 11, // Tipo de comprobante (ver tipos disponibles) 
        'Concepto': 1, // Concepto del Comprobante: (1)Productos, (2)Servicios, (3)Productos y Servicios
        'DocTipo': 99, // Tipo de documento del comprador (99 consumidor final, ver tipos disponibles)
        'DocNro': 0, // Numero de documento del comprador (0 consumidor final)
        'CbteDesde': 1, // Numero de comprobante o numero del primer comprobante en caso de ser mas de uno
        'CbteHasta': 1, // Numero de comprobante o numero del ultimo comprobante en caso de ser mas de uno
        'CbteFch': parseInt(date.replace(/-/g, '')), // (Opcional) Fecha del comprobante (yyyymmdd) o fecha actual si es nulo
        'ImpTotal': totalAmount, // Importe total del comprobante
        'ImpTotConc': 0, // Importe neto no gravado
        'ImpNeto': totalAmount, // Importe neto gravado
        'ImpOpEx': 0, // Importe exento
        'ImpIVA': 0, // Importe total de IVA
        'ImpTrib': 0, //Importe total de tributos
        'MonId': 'PES', //Tipo de moneda usada en el comprobante (ver tipos disponibles) 'PES' para pesos argentinos
        'MonCotiz': 1, // Cotización de la moneda usada (1 para pesos argentinos)  
    };

    try {
        // Retrieve Last Voucher to set CbteDesde/Hasta correctly
        const lastVoucher = await this.afip.ElectronicBilling.getLastVoucher(1, 11);
        payload['CbteDesde'] = lastVoucher + 1;
        payload['CbteHasta'] = lastVoucher + 1;

        const res = await this.afip.ElectronicBilling.createVoucher(payload);
        
        // Save to DB
        const factura = this.facturasRepository.create({
            puntoVenta: payload.PtoVta,
            tipoCbte: payload.CbteTipo,
            nroCbte: payload['CbteDesde'],
            fechaCbte: payload.CbteFch.toString(),
            impTotal: payload.ImpTotal,
            cae: res.CAE,
            vtoCae: res.CAEFchVto,
            docNro: payload.DocNro,
            clientId: data.clientId,
            userId: userId
        } as unknown as Factura);

        return (await this.facturasRepository.save(factura)) as Factura;

    } catch (error) {
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
}
