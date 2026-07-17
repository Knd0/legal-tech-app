import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, PreApproval, Payment } from 'mercadopago';
import { UsersService } from '../users/users.service';

@Injectable()
export class MercadopagoService {
  private readonly logger = new Logger(MercadopagoService.name);
  private client: MercadoPagoConfig;

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const accessToken = this.configService.get<string>('MP_ACCESS_TOKEN');
    if (accessToken) {
      this.client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
    } else {
      this.logger.warn('MP_ACCESS_TOKEN not configured.');
    }
  }

  async createSubscriptionForUser(userId: string, payerEmail: string, planName: string = 'Themis Pro', amount: number = 35000) {
    if (!this.client) throw new Error("MercadoPago not configured");

    const preApproval = new PreApproval(this.client);
    return preApproval.create({
      body: {
        reason: planName,
        external_reference: userId,
        payer_email: payerEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: amount,
          currency_id: 'ARS',
        },
        back_url: `${this.configService.get<string>('FRONTEND_URL', 'https://legal-tech-app-woad.vercel.app')}/subscription/success`,
        status: 'pending',
      }
    });
  }

  async getSubscriptionStatus(userId: string) {
    const user = await this.usersService.findOneById(userId);
    if (!user) throw new Error('User not found');
    return {
      status: user.subscription?.subscriptionStatus,
      expiresAt: user.subscription?.subscriptionExpiresAt,
      mpSubscriptionId: user.subscription?.mpSubscriptionId,
      subscriptionPlan: user.subscription?.subscriptionPlan,
    };
  }

  async cancelSubscription(userId: string) {
    const user = await this.usersService.findOneById(userId);
    if (!user) throw new Error('User not found');

    if (user.subscription?.mpSubscriptionId && this.client) {
      try {
        const preApproval = new PreApproval(this.client);
        await preApproval.update({
          id: user.subscription.mpSubscriptionId,
          body: { status: 'cancelled' },
        });
      } catch (error) {
        this.logger.error(`Error cancelling MP subscription: ${error}`);
      }
    }

    await this.usersService.updateSubscription(userId, { subscriptionStatus: 'cancelled' });
    return { success: true };
  }

  async getPaymentHistory(userId: string): Promise<{ payments: any[] }> {
    if (!this.client) return { payments: [] };
    try {
      const payment = new Payment(this.client);
      const result = await payment.search({
        options: { external_reference: userId, sort: 'date_created', criteria: 'desc', limit: 10 } as any,
      });
      return {
        payments: (result.results ?? []).map((p: any) => ({
          id: p.id,
          date: p.date_created,
          amount: p.transaction_amount,
          currency: p.currency_id,
          status: p.status,
          description: p.description || 'Suscripción Themis',
        })),
      };
    } catch (error) {
      this.logger.error('Error fetching payment history', error);
      return { payments: [] };
    }
  }

  async reactivateSubscription(userId: string): Promise<{ success: boolean }> {
    const user = await this.usersService.findOneById(userId);
    if (!user) throw new Error('User not found');
    if (!user.subscription?.mpSubscriptionId || !this.client) throw new Error('No hay suscripción para reactivar');

    const preApproval = new PreApproval(this.client);
    await preApproval.update({ id: user.subscription.mpSubscriptionId, body: { status: 'authorized' } as any });
    await this.usersService.updateSubscription(userId, { subscriptionStatus: 'active' });
    return { success: true };
  }

  async simulateSubscriptionPayment(userId: string, plan: string = 'pro'): Promise<{ success: boolean }> {
    const user = await this.usersService.findOneById(userId);
    if (!user) throw new Error('User not found');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

    await this.usersService.updateSubscription(userId, {
      subscriptionStatus: 'active',
      subscriptionPlan: plan,
      subscriptionExpiresAt: expiresAt,
      mpSubscriptionId: 'mock_sub_simulated_' + plan + '_' + Math.floor(Math.random() * 1000000)
    });

    this.logger.log(`Simulated active subscription for user ${userId} on plan ${plan}`);
    return { success: true };
  }

  async handleWebhook(data: any): Promise<void> {
    this.logger.log(`Received Webhook: ${JSON.stringify(data)}`);

    if (data.type === 'subscription_preapproval') {
      const preapprovalId = data.data.id;
      const preApprovalAPI = new PreApproval(this.client);

      try {
        const subscription = await preApprovalAPI.get({ id: preapprovalId });
        this.logger.log(`Subscription details: ${JSON.stringify(subscription)}`);

        const userId = subscription.external_reference;
        const status = subscription.status;
        const reason = (subscription.reason || '').toLowerCase();
        const plan = reason.includes('básico') || reason.includes('basic') ? 'basic' : 'pro';

        if (userId) {
          let mappedStatus = 'trial';
          if (status === 'authorized') mappedStatus = 'active';
          else if (status === 'paused') mappedStatus = 'paused';
          else if (status === 'cancelled') mappedStatus = 'cancelled';

          await this.usersService.updateSubscription(userId, {
            mpSubscriptionId: preapprovalId,
            subscriptionStatus: mappedStatus,
            subscriptionPlan: plan,
          });
          this.logger.log(`Updated user ${userId} subscription status to ${mappedStatus} and plan to ${plan}`);
        }
      } catch (error) {
        this.logger.error(`Error processing webhook: ${error}`);
      }
    }
  }
}
