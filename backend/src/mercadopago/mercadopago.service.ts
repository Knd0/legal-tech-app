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

  getAccessTokenStatus() {
    const accessToken = this.configService.get<string>('MP_ACCESS_TOKEN');
    if (!accessToken) {
      return { configured: false, error: 'MP_ACCESS_TOKEN is missing or empty' };
    }
    const parts = accessToken.split('-');
    return {
      configured: true,
      length: accessToken.length,
      prefix: parts[0] || 'unknown',
      isSandbox: accessToken.startsWith('TEST-'),
      clientInitialized: !!this.client
    };
  }

  async createSubscriptionForUser(userId: string, payerEmail: string, planName: string = 'Themis Pro', amount: number = 35000) {
    if (!this.client) throw new Error("MercadoPago not configured");

    const preApproval = new PreApproval(this.client);
    const result = await preApproval.create({
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

    // Save pending subscription ID immediately so Success view has reference
    const plan = planName.toLowerCase().includes('básico') || planName.toLowerCase().includes('basic') ? 'basic' : 'pro';
    await this.usersService.updateSubscription(userId, {
      mpSubscriptionId: result.id,
      subscriptionStatus: 'pending',
      subscriptionPlan: plan,
    });

    return result;
  }

  async getSubscriptionStatus(userId: string) {
    const user = await this.usersService.findOneById(userId);
    if (!user) throw new Error('User not found');

    const mpSubId = user.subscription?.mpSubscriptionId;
    if (mpSubId && this.client && !mpSubId.startsWith('mock_')) {
      try {
        const preApprovalAPI = new PreApproval(this.client);
        const subscription = await preApprovalAPI.get({ id: mpSubId });

        const status = subscription.status;
        const reason = (subscription.reason || '').toLowerCase();
        const plan = reason.includes('básico') || reason.includes('basic') ? 'basic' : 'pro';
        const expiresAtStr = subscription.next_payment_date;
        const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;

        let mappedStatus = 'trial';
        if (status === 'authorized') mappedStatus = 'active';
        else if (status === 'paused') mappedStatus = 'paused';
        else if (status === 'cancelled') mappedStatus = 'cancelled';

        await this.usersService.updateSubscription(userId, {
          mpSubscriptionId: mpSubId,
          subscriptionStatus: mappedStatus,
          subscriptionPlan: plan,
          subscriptionExpiresAt: expiresAt,
        });

        return {
          status: mappedStatus,
          expiresAt: expiresAt,
          mpSubscriptionId: mpSubId,
          subscriptionPlan: plan,
        };
      } catch (error) {
        this.logger.error(`Error syncing MP subscription status in real-time: ${error}`);
      }
    }

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

    if (user.subscription?.mpSubscriptionId && this.client && !user.subscription.mpSubscriptionId.startsWith('mock_')) {
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

    if (!user.subscription.mpSubscriptionId.startsWith('mock_')) {
      const preApproval = new PreApproval(this.client);
      await preApproval.update({ id: user.subscription.mpSubscriptionId, body: { status: 'authorized' } as any });
    }
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

    const isSubscriptionEvent = 
      data.type === 'subscription_preapproval' || 
      data.type === 'preapproval' ||
      (data.action === 'created' && data.type === 'preapproval');

    if (isSubscriptionEvent && data.data?.id) {
      const preapprovalId = data.data.id;
      if (!this.client) return;

      const preApprovalAPI = new PreApproval(this.client);

      try {
        const subscription = await preApprovalAPI.get({ id: preapprovalId });
        this.logger.log(`Subscription details from webhook: ${JSON.stringify(subscription)}`);

        const userId = subscription.external_reference;
        const status = subscription.status;
        const reason = (subscription.reason || '').toLowerCase();
        const plan = reason.includes('básico') || reason.includes('basic') ? 'basic' : 'pro';
        const expiresAtStr = subscription.next_payment_date;
        const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;

        if (userId) {
          let mappedStatus = 'trial';
          if (status === 'authorized') mappedStatus = 'active';
          else if (status === 'paused') mappedStatus = 'paused';
          else if (status === 'cancelled') mappedStatus = 'cancelled';

          await this.usersService.updateSubscription(userId, {
            mpSubscriptionId: preapprovalId,
            subscriptionStatus: mappedStatus,
            subscriptionPlan: plan,
            subscriptionExpiresAt: expiresAt,
          });
          this.logger.log(`Webhook updated user ${userId} subscription status to ${mappedStatus}, plan to ${plan}, expiresAt to ${expiresAt}`);
        }
      } catch (error) {
        this.logger.error(`Error processing webhook: ${error}`);
      }
    }
  }
}
