import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { DeadlinesService } from '../deadlines/deadlines.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';
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
    private readonly usersService: UsersService,
    @InjectRepository(PushSubscription)
    private readonly pushSubscriptionRepository: Repository<PushSubscription>,
  ) {
    const pubKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const email = this.configService.get<string>('VAPID_EMAIL') || 'mailto:admin@themis.com';

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

  @Cron(CronExpression.EVERY_HOUR) // Runs every hour to support customizable alert times and repetitions
  async handleCron() {
    this.logger.debug('Running hourly deadline check...');
    const now = new Date();
    const currentHour = now.getHours();
    const today = new Date();
    today.setHours(0,0,0,0);

    const deadlines = await this.deadlinesService.findAll();

    for (const d of deadlines) {
      if (d.estado !== 'PENDIENTE') continue;

      const lawyerUserId = d.userId || d.expediente?.userId;
      if (!lawyerUserId) continue;

      // Fetch the lawyer/user associated with the deadline
      const user = await this.usersService.findOneById(lawyerUserId);
      if (!user) continue;

      // Determine alert times for this user (evenly spaced throughout 24 hours starting from alertHour)
      const startHour = user.alertHour ?? 9;
      const reps = user.alertRepetitions ?? 1;
      const scheduledHours: number[] = [];
      const interval = Math.floor(24 / reps);
      for (let i = 0; i < reps; i++) {
        scheduledHours.push((startHour + i * interval) % 24);
      }

      // Check if currentHour matches one of the scheduled hours
      if (!scheduledHours.includes(currentHour)) continue;

      const dueDate = new Date(d.fechaVencimiento);
      dueDate.setHours(0,0,0,0);

      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      const userDaysBeforeAlert = user.alertDaysBefore ?? 3;

      // Notify if within range OR if it is today (0)
      if (diffDays <= userDaysBeforeAlert && diffDays >= 0) {
        // Prevent duplicate sending for the same hour
        const lastSentDate = d.fechaAviso ? new Date(d.fechaAviso) : null;
        if (
          lastSentDate && 
          lastSentDate.toDateString() === now.toDateString() && 
          lastSentDate.getHours() === currentHour
        ) {
          continue; // Already sent for this repetition slot today
        }

        // 1. WhatsApp to Lawyer (User) (if enabled, verified, and phone exists)
        if (user.whatsappAlertsEnabled && user.isPhoneVerified && user.phoneNumber) {
          const message = `📅 *Recordatorio de Vencimiento*\n🔔 Vencimiento: *${d.titulo}*\n⏳ Falta: *${diffDays} días*\n📂 Expediente: ${d.expediente?.caratula || 'Sin carátula'}\n📝 Desc: ${d.descripcion || 'Sin descripción'}`;
          try {
              await this.whatsappService.sendMessage(user.phoneNumber, message);
              this.logger.log(`WhatsApp notification sent to lawyer ${user.fullName} for deadline ${d.titulo}`);
          } catch (e) {
              this.logger.error(`Failed to send WhatsApp notification to lawyer ${user.phoneNumber} for ${d.titulo}`, e);
          }
        }

        // 2. WhatsApp to Client (if enabled, verified, and client phone exists)
        if (user.whatsappAlertsEnabled && user.isPhoneVerified && d.expediente && d.expediente.cliente && d.expediente.cliente.telefono) {
          const message = `📅 *Recordatorio Legal*\n🔔 Vencimiento: *${d.titulo}*\n⏳ Falta: *${diffDays} días*\n📂 Desc: ${d.descripcion || 'Sin descripción'}`;
          try {
              await this.whatsappService.sendMessage(d.expediente.cliente.telefono, message);
              this.logger.log(`WhatsApp notification sent to client ${d.expediente.cliente.nombre} for deadline ${d.titulo}`);
          } catch (e) {
              this.logger.error(`Failed to send WhatsApp notification for ${d.titulo}`, e);
          }
        }

        // 3. Web Push to Lawyer (User)
        const desktopEnabled = user.desktopAlertsEnabled ?? true;
        if (desktopEnabled) {
          const pushTitle = diffDays === 0 ? `⚠️ Vencimiento HOY` : `🔔 Vencimiento Próximo`;
          const pushBody = `El vencimiento "${d.titulo}" expira en ${diffDays} días (Expediente: ${d.expediente?.caratula || 'Sin carátula'}).`;
          try {
            await this.sendPushNotification(user.id, pushTitle, pushBody, { url: '/calendario' });
            this.logger.log(`Web Push notification sent to lawyer ${user.fullName} for deadline ${d.titulo}`);
          } catch (e) {
            this.logger.error(`Failed to send Web Push to lawyer ${user.id} for deadline ${d.titulo}`, e);
          }
        }

        // Update last sent date
        try {
          await this.deadlinesService.update(d.id, { fechaAviso: now });
        } catch (e) {
          this.logger.error(`Failed to update fechaAviso for deadline ${d.id}`, e);
        }
      }
    }
  }
}
