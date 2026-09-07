import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
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

  /**
   * La sincronización contra PJN/MEV **todavía no está implementada**:
   * `fetchNovedadesMock()` devuelve actuaciones inventadas. Persistirlas y
   * notificarlas por WhatsApp es indistinguible de un plazo procesal real, asi
   * que la función queda apagada salvo que se active explícitamente para demos
   * o desarrollo con `JUDICIAL_SYNC_ENABLED=true`.
   *
   * Al implementar el scraping real: reemplazar `fetchNovedadesMock` por el
   * adapter correspondiente, volver a etiquetar el origen como `AUTOMATICO_*` y
   * recién ahí invertir el default de este flag.
   */
  private readonly syncEnabled = process.env.JUDICIAL_SYNC_ENABLED === 'true';

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
    if (!this.syncEnabled) {
      this.logger.warn(
        'Sincronizacion judicial nocturna omitida: JUDICIAL_SYNC_ENABLED no está activo ' +
          '(el scraping real de PJN/MEV aún no está implementado).',
      );
      return;
    }
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
   *
   * `userId` acota la búsqueda al dueño cuando la sincronización la dispara un
   * usuario (`POST /expedientes/:id/sync`). El cron nocturno lo omite porque ya
   * itera sobre expedientes que seleccionó él mismo.
   */
  async syncExpediente(expedienteId: string, userId?: string): Promise<{ added: number }> {
    if (!this.syncEnabled) {
      // Error explícito y no un no-op silencioso: la UI ofrece un botón
      // "Sincronizar" y un 200 con `added: 0` le diria al abogado que no hay
      // novedades, que es exactamente la conclusión peligrosa.
      throw new ServiceUnavailableException(
        'La sincronización automática con portales judiciales todavía no está disponible. ' +
          'Cargá las actuaciones manualmente.',
      );
    }

    const exp = await this.expedientesRepository.findOne({
      where: userId ? { id: expedienteId, userId } : { id: expedienteId },
      relations: ['user'],
    });
    if (!exp) {
      throw new NotFoundException('Expediente no encontrado.');
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
          // `SIMULADO_*` mientras la fuente sea el mock: nada generado por
          // datos inventados debe presentarse como una actuación automática real.
          origen: `SIMULADO_${exp.portalJudicial}`,
        });
        const savedAct = await this.actuacionesRepository.save(newAct);
        addedCount++;

        // 4. Enviar notificación por WhatsApp al abogado si tiene el celular verificado
        if (lawyer.isPhoneVerified && lawyer.phoneNumber && lawyer.alertWhatsapp) {
          const messageText = `*[DEMO - dato simulado]*
🔔 *Novedad Judicial - Themis*\n\n` +
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
   * MOCK — NO es un scraper. Devuelve actuaciones **inventadas** y hardcodeadas
   * para PJN y MEV PBA, con `fecha` de ayer para que parezcan recientes.
   *
   * Sólo corre con `JUDICIAL_SYNC_ENABLED=true` (demos y desarrollo). Todo lo que
   * genera se guarda con `origen: 'SIMULADO_*'` y se anuncia como simulado.
   *
   * Reemplazar por un adapter real por portal antes de habilitarlo en producción.
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
