import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { DeadlinesService } from '../deadlines/deadlines.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SettingsService } from '../settings/settings.service';
import { PushSubscription } from './entities/push-subscription.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private vapidPublicKey: string;
  private vapidPrivateKey: string;

  constructor(
    private readonly deadlinesService: DeadlinesService,
    private readonly whatsappService: WhatsappService,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
    @InjectRepository(PushSubscription)
    private readonly pushSubscriptionRepository: Repository<PushSubscription>,
  ) {
    const pubKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const email = this.configService.get<string>('VAPID_EMAIL') || 'mailto:admin@legaltech.com';

    if (pubKey && privKey) {
      this.vapidPublicKey = pubKey;
      this.vapidPrivateKey = privKey;
    } else {
      this.logger.warn('VAPID keys not configured in environment variables. Generating ephemeral keys for development...');
      const keys = webpush.generateVAPIDKeys();
      this.vapidPublicKey = keys.publicKey;
      this.vapidPrivateKey = keys.privateKey;
      this.logger.log(`Generated Ephemeral VAPID Public Key: ${keys.publicKey}`);
      this.logger.log(`Generated Ephemeral VAPID Private Key: ${keys.privateKey}`);
    }

    webpush.setVapidDetails(
      email,
      this.vapidPublicKey,
      this.vapidPrivateKey
    );
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }

  async subscribe(
    userId: string,
    subscriptionDto: { endpoint: string; expirationTime?: number; keys: { p256dh: string; auth: string } },
  ): Promise<void> {
    const existing = await this.pushSubscriptionRepository.findOneBy({ endpoint: subscriptionDto.endpoint });
    if (existing) {
      existing.userId = userId;
      existing.p256dh = subscriptionDto.keys.p256dh;
      existing.auth = subscriptionDto.keys.auth;
      existing.expirationTime = subscriptionDto.expirationTime || null;
      await this.pushSubscriptionRepository.save(existing);
    } else {
      const newSub = this.pushSubscriptionRepository.create({
        userId,
        endpoint: subscriptionDto.endpoint,
        p256dh: subscriptionDto.keys.p256dh,
        auth: subscriptionDto.keys.auth,
        expirationTime: subscriptionDto.expirationTime || null,
      });
      await this.pushSubscriptionRepository.save(newSub);
    }
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.pushSubscriptionRepository.delete({ userId, endpoint });
  }

  async sendPushNotification(userId: string, title: string, body: string, data?: any): Promise<void> {
    const subscriptions = await this.pushSubscriptionRepository.findBy({ userId });
    
    if (subscriptions.length === 0) {
      this.logger.debug(`No active push subscriptions found for user ${userId}`);
      return;
    }

    const payload = JSON.stringify({
      notification: {
        title,
        body,
        icon: '/assets/icons/icon-72x72.png',
        badge: '/favicon.ico',
        data: data || { url: '/calendario' }
      }
    });

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
        this.logger.log(`Web Push sent successfully to endpoint: ${sub.endpoint.substring(0, 40)}...`);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          this.logger.log(`Obsolete subscription endpoint detected (${err.statusCode}). Removing subscription...`);
          await this.pushSubscriptionRepository.delete(sub.id);
        } else {
          this.logger.error(`Failed to send Web Push notification to endpoint ${sub.endpoint.substring(0, 40)}...`, err);
        }
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM) // Runs at 9:00 AM daily
  async handleCron() {
    this.logger.debug('Running daily deadline check...');
    const settings = await this.settingsService.getSettings();
    const deadlines = await this.deadlinesService.findAll();
    const today = new Date();
    today.setHours(0,0,0,0);

    for (const d of deadlines) {
      if (d.estado !== 'PENDIENTE') continue;

      const dueDate = new Date(d.fechaVencimiento);
      dueDate.setHours(0,0,0,0);

      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      // Notify if within range (e.g. 3 days) OR if it is today (0)
      if (diffDays <= settings.daysBeforeAlert && diffDays >= 0) {
           // 1. WhatsApp to Client (if enabled and client phone details exist)
           if (settings.enableWhatsapp && d.expediente && d.expediente.cliente && d.expediente.cliente.telefono) {
             const message = `📅 *Recordatorio Legal*\n🔔 Vencimiento: *${d.titulo}*\n⏳ Falta: *${diffDays} días*\n📂 Desc: ${d.descripcion || 'Sin descripción'}`;
             try {
                 await this.whatsappService.sendMessage(d.expediente.cliente.telefono, message);
                 this.logger.log(`Notification sent to ${d.expediente.cliente.nombre} for deadline ${d.titulo}`);
             } catch (e) {
                 this.logger.error(`Failed to send notification for ${d.titulo}`, e);
             }
           }

           // 2. Web Push to Lawyer (User)
           const lawyerUserId = d.userId || d.expediente?.userId;
           if (lawyerUserId) {
             const pushTitle = diffDays === 0 ? `⚠️ Vencimiento HOY` : `🔔 Vencimiento Próximo`;
             const pushBody = `El vencimiento "${d.titulo}" expira en ${diffDays} días (Expediente: ${d.expediente?.caratula || 'Sin carátula'}).`;
             try {
               await this.sendPushNotification(lawyerUserId, pushTitle, pushBody, { url: '/calendario' });
             } catch (e) {
               this.logger.error(`Failed to send Web Push to lawyer ${lawyerUserId} for deadline ${d.titulo}`, e);
             }
           }
      }
    }
  }
}
