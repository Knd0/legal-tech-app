import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, PreApprovalPlan, PreApproval, Payment } from 'mercadopago';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class MercadopagoService {
  private readonly logger = new Logger(MercadopagoService.name);
  private client: MercadoPagoConfig;

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {
    const accessToken = this.configService.get<string>('MP_ACCESS_TOKEN');
    if (accessToken) {
      this.client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
    } else {
      this.logger.warn('MP_ACCESS_TOKEN not configured.');
    }
  }

  // PreApprovalPlans are the blueprints for subscriptions
  async createSubscriptionPlan(planData: any) {
    if (!this.client) throw new Error("MercadoPago not configured");
    const preApprovalPlan = new PreApprovalPlan(this.client);
    
    return preApprovalPlan.create({
      body: {
        reason: planData.reason || 'Suscripción Themis',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          billing_day: 10,
          billing_day_proportional: false,
          transaction_amount: planData.amount || 15000,
          currency_id: 'ARS',
        },
        payment_methods_allowed: {
          payment_types: [
            { id: 'credit_card' },
            { id: 'debit_card' }
          ],
        },
        back_url: `${this.configService.get<string>('FRONTEND_URL', 'https://legal-tech-app-woad.vercel.app')}/subscription/success`,
      }
    });
  }

  // A PreApproval is an actual subscription of a client to a plan
  async createSubscriptionForUser(userId: string, payerEmail: string) {
      if (!this.client) throw new Error("MercadoPago not configured");

      const preApproval = new PreApproval(this.client);
      const request = {
          body: {
             reason: 'Themis Pro',
             external_reference: userId,
             payer_email: payerEmail,
             auto_recurring: {
                 frequency: 1,
                 frequency_type: 'months',
                 transaction_amount: 15000,
                 currency_id: 'ARS',
             },
             back_url: `${this.configService.get<string>('FRONTEND_URL', 'https://legal-tech-app-woad.vercel.app')}/subscription/success`,
             status: 'pending'
          }
      };

      const result = await preApproval.create(request);
      return result;
  }

  async getSubscriptionStatus(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    return {
      status: user.subscriptionStatus,
      expiresAt: user.subscriptionExpiresAt,
      mpSubscriptionId: user.mpSubscriptionId,
    };
  }

  async cancelSubscription(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    if (user.mpSubscriptionId && this.client) {
      try {
        const preApproval = new PreApproval(this.client);
        await preApproval.update({
          id: user.mpSubscriptionId,
          body: { status: 'cancelled' },
        });
      } catch (error) {
        this.logger.error(`Error cancelling MP subscription: ${error}`);
      }
    }

    await this.usersRepository.update(userId, { subscriptionStatus: 'cancelled' });
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
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (!user.mpSubscriptionId || !this.client) throw new Error('No hay suscripción para reactivar');

    const preApproval = new PreApproval(this.client);
    await preApproval.update({ id: user.mpSubscriptionId, body: { status: 'authorized' } as any });
    await this.usersRepository.update(userId, { subscriptionStatus: 'active' });
    return { success: true };
  }

  async handleWebhook(data: any): Promise<void> {
    this.logger.log(`Received Webhook: ${JSON.stringify(data)}`);
    
    // Check if it's a subscription update
    if (data.type === 'subscription_preapproval') {
        const preapprovalId = data.data.id;
        const preApprovalAPI = new PreApproval(this.client);
        
        try {
            const subscriptionParams = { id: preapprovalId };
            // In SDK v2, getting a preapproval looks something like this:
            const subscription = await preApprovalAPI.get(subscriptionParams);
            this.logger.log(`Subscription details: ${JSON.stringify(subscription)}`);
            
            const userId = subscription.external_reference;
            const status = subscription.status; // 'authorized', 'paused', 'cancelled'
            
            if (userId) {
               let mappedStatus = 'trial';
               if (status === 'authorized') mappedStatus = 'active';
               else if (status === 'paused') mappedStatus = 'paused';
               else if (status === 'cancelled') mappedStatus = 'cancelled';

               await this.usersRepository.update(userId, {
                   mpSubscriptionId: preapprovalId,
                   subscriptionStatus: mappedStatus
               });
               this.logger.log(`Updated user ${userId} subscription status to ${mappedStatus}`);
            }
        } catch (error) {
            this.logger.error(`Error processing webhook: ${error}`);
        }
    }
  }
}
