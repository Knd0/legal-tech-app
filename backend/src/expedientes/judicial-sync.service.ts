import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Expediente } from './expediente.entity';
import { Actuacion } from './actuacion.entity';
import { User } from '../users/entities/user.entity';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class JudicialSyncService {
  private readonly logger = new Logger(JudicialSyncService.name);

  constructor(
    @InjectRepository(Expediente)
    private readonly expedientesRepository: Repository<Expediente>,
    @InjectRepository(Actuacion)
    private readonly actuacionesRepository: Repository<Actuacion>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly whatsappService: WhatsappService,
  ) {}

  /**
   * Cron nocturno que se ejecuta a las 3:00 AM para sincronizar expedientes.
   */
  @Cron('0 3 * * *')
  async handleNightlySync() {
    this.logger.log('Iniciando sincronización judicial automática nocturna...');
    const expedientes = await this.expedientesRepository.find({
      where: { autoSync: true },
    });

    let syncCount = 0;
    for (const exp of expedientes) {
      if (exp.portalJudicial && exp.portalJudicial !== 'NINGUNO' && exp.portalId) {
        try {
          await this.syncExpediente(exp.id);
          syncCount++;
        } catch (e) {
          this.logger.error(`Error al sincronizar expediente ${exp.id}: ${e.message}`);
        }
      }
    }
    this.logger.log(`Sincronización judicial nocturna finalizada. ${syncCount} expedientes procesados.`);
  }

  /**
   * Ejecuta la sincronización de un expediente específico.
   * Si detecta nuevas actuaciones, las guarda y envía alertas.
   */
  async syncExpediente(expedienteId: string): Promise<{ added: number }> {
    const exp = await this.expedientesRepository.findOne({
      where: { id: expedienteId },
      relations: ['user'],
    });
    if (!exp) {
      throw new Error('Expediente no encontrado.');
    }

    if (!exp.portalJudicial || exp.portalJudicial === 'NINGUNO' || !exp.portalId) {
      return { added: 0 };
    }

    // 1. Obtener credenciales del abogado creador del caso
    const lawyer = await this.usersRepository.findOne({ where: { id: exp.userId } });
    if (!lawyer) {
      throw new Error('Abogado titular del caso no encontrado.');
    }

    // 2. Simular/Ejecutar Scraper de Portal
    this.logger.log(`Consultando novedades en ${exp.portalJudicial} para causa ID ${exp.portalId}...`);
    const fetchedActuaciones = await this.fetchNovedadesMock(exp);

    // 3. Filtrar actuaciones nuevas (no guardadas previamente)
    let addedCount = 0;
    for (const act of fetchedActuaciones) {
      const exists = await this.actuacionesRepository.findOne({
        where: {
          expedienteId: exp.id,
          fecha: act.fecha,
          titulo: act.titulo,
        },
      });

      if (!exists) {
        const newAct = this.actuacionesRepository.create({
          ...act,
          expedienteId: exp.id,
          origen: `AUTOMATICO_${exp.portalJudicial}`,
        });
        const savedAct = await this.actuacionesRepository.save(newAct);
        addedCount++;

        // 4. Enviar notificación por WhatsApp al abogado si tiene el celular verificado
        if (lawyer.isPhoneVerified && lawyer.phoneNumber && lawyer.alertWhatsapp) {
          const messageText = `🔔 *Novedad Judicial - Themis*\n\n` +
            `Se registró un nuevo movimiento en la causa *${exp.caratula.toUpperCase()}* (${exp.portalJudicial}):\n\n` +
            `📅 *Fecha:* ${new Date(savedAct.fecha).toLocaleDateString('es-AR')}\n` +
            `📌 *Movimiento:* *${savedAct.titulo}*\n` +
            `📝 *Detalle:* ${savedAct.descripcion.substring(0, 100)}...\n\n` +
            `_Ingresá a Themis para leer el proveído completo._`;

          try {
            await this.whatsappService.sendMessage(lawyer.phoneNumber, messageText);
          } catch (wsErr) {
            this.logger.warn(`No se pudo enviar la alerta de WhatsApp al abogado: ${wsErr.message}`);
          }
        }
      }
    }

    return { added: addedCount };
  }

  /**
   * Retorna el historial de actuaciones de un expediente.
   */
  async getActuaciones(expedienteId: string, userId: string): Promise<Actuacion[]> {
    return this.actuacionesRepository.find({
      where: { expedienteId, expediente: { userId } },
      order: { fecha: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Crea una actuación de forma manual.
   */
  async createManualActuacion(expedienteId: string, data: Partial<Actuacion>, userId: string): Promise<Actuacion> {
    const exp = await this.expedientesRepository.findOne({ where: { id: expedienteId, userId } });
    if (!exp) {
      throw new Error('Expediente no encontrado.');
    }
    const act = this.actuacionesRepository.create({
      ...data,
      expedienteId,
      origen: 'MANUAL',
    });
    return this.actuacionesRepository.save(act);
  }

  /**
   * Elimina una actuación.
   */
  async removeActuacion(id: string, expedienteId: string, userId: string): Promise<void> {
    const act = await this.actuacionesRepository.findOne({
      where: { id, expedienteId, expediente: { userId } },
    });
    if (!act) {
      throw new Error('Actuación no encontrada.');
    }
    await this.actuacionesRepository.remove(act);
  }

  /**
   * MOCK de Scraper Judicial
   * Devuelve novedades de prueba realistas para PJN y MEV PBA.
   */
  private async fetchNovedadesMock(exp: Expediente): Promise<Partial<Actuacion>[]> {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (exp.portalJudicial === 'PJN') {
      return [
        {
          fecha: yesterday,
          titulo: 'PROVEIDO TRASLADO DE EXCEPCIONES',
          descripcion: 'Buenos Aires, 17 de Julio de 2026. Por presentadas las excepciones de falta de legitimación pasiva. Córrase traslado a la parte actora por el término de cinco (5) días bajo apercibimiento de ley. Notifíquese por cédula electrónica. Fdo: Juez Nacional.',
          foja: 'Digital',
        },
        {
          fecha: new Date(exp.fechaInicio),
          titulo: 'RESOLUCION DE APERTURA A PRUEBA',
          descripcion: 'Buenos Aires. VISTOS: Y considerando la existencia de hechos conducentes y controvertidos, ábrese la presente causa a prueba por el término de cuarenta (40) días. Fíjese audiencia testimonial para el día...',
          foja: '12',
        },
      ];
    } else if (exp.portalJudicial === 'MEV_PBA') {
      return [
        {
          fecha: yesterday,
          titulo: 'DESPACHO SIMPLE - TRASLADO CÉDULA',
          descripcion: 'La Plata, 17 de Julio de 2026. Téngase por recibida la cédula de notificación digital diligenciada. A lo demás solicitado, previo pago de la tasa de justicia, se proveerá lo que corresponda. Fdo: Juez de Primera Instancia.',
          foja: 'Digital',
        },
        {
          fecha: new Date(exp.fechaInicio),
          titulo: 'DESPACHO DE INICIO DE DEMANDA',
          descripcion: 'La Plata. Por presentada en tiempo y forma la demanda ordinaria. Intímese a la parte demandada a comparecer y contestar la misma dentro del plazo perentorio de quince (15) días bajo apercibimiento de rebeldía.',
          foja: '2',
        },
      ];
    }

    return [];
  }
}
