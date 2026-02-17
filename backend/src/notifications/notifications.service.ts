import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DeadlinesService } from '../deadlines/deadlines.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly deadlinesService: DeadlinesService,
    private readonly whatsappService: WhatsappService,
    private readonly settingsService: SettingsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM) // Runs at 9:00 AM daily
  async handleCron() {
    this.logger.debug('Running daily deadline check...');
    const settings = await this.settingsService.getSettings();
    
    if (!settings.enableWhatsapp) {
        this.logger.debug('WhatsApp notifications are disabled in settings.');
        return;
    }

    const deadlines = await this.deadlinesService.findAll();
    const today = new Date();
    today.setHours(0,0,0,0);

    for (const d of deadlines) {
      if (d.estado !== 'PENDIENTE' || !d.expediente || !d.expediente.cliente || !d.expediente.cliente.telefono) continue;

      const dueDate = new Date(d.fechaVencimiento);
      dueDate.setHours(0,0,0,0);

      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      // Notify if within range (e.g. 3 days) OR if it is today (0)
      if (diffDays <= settings.daysBeforeAlert && diffDays >= 0) {
           const message = `📅 *Recordatorio Legal*\n🔔 Vencimiento: *${d.titulo}*\n⏳ Falta: *${diffDays} días*\n📂 Desc: ${d.descripcion || 'Sin descripción'}`;
           try {
               await this.whatsappService.sendMessage(d.expediente.cliente.telefono, message);
               this.logger.log(`Notification sent to ${d.expediente.cliente.nombre} for deadline ${d.titulo}`);
           } catch (e) {
               this.logger.error(`Failed to send notification for ${d.titulo}`, e);
           }
      }
    }
  }
}
