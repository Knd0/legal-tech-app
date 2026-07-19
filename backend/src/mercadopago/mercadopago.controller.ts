import { Controller, Post, Body, Req, Res, Get, UseGuards, UnauthorizedException, Logger } from '@nestjs/common';
import { MercadopagoService } from './mercadopago.service';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as crypto from 'crypto';

@Controller('mercadopago')
export class MercadopagoController {
  private readonly logger = new Logger(MercadopagoController.name);

  constructor(private readonly mpService: MercadopagoService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create-subscription')
  async createSubscription(@Req() req, @Body('plan') plan: string, @Res() res: Response) {
    try {
      const user = req.user;
      const targetPlan = plan === 'basic' ? 'basic' : 'pro';
      const amount = targetPlan === 'basic' ? 1 : 1; // Cambiado temporalmente a 1 para pruebas de producción
      const planName = targetPlan === 'basic' ? 'Themis Básico' : 'Themis Pro';
      const result = await this.mpService.createSubscriptionForUser(user.userId, user.username, planName, amount);
      return res.status(200).json({ preapprovalLink: result.init_point });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  async getSubscription(@Req() req, @Res() res: Response) {
    try {
      const result = await this.mpService.getSubscriptionStatus(req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel-subscription')
  async cancelSubscription(@Req() req, @Res() res: Response) {
    try {
      await this.mpService.cancelSubscription(req.user.userId);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('payment-history')
  async getPaymentHistory(@Req() req, @Res() res: Response) {
    try {
      const result = await this.mpService.getPaymentHistory(req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('reactivate-subscription')
  async reactivateSubscription(@Req() req, @Res() res: Response) {
    try {
      const result = await this.mpService.reactivateSubscription(req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('simulate-payment')
  async simulatePayment(@Req() req, @Body('plan') plan: string, @Res() res: Response) {
    try {
      const targetPlan = plan === 'basic' ? 'basic' : 'pro';
      const result = await this.mpService.simulateSubscriptionPayment(req.user.userId, targetPlan);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Post('webhook')
  async handleWebhook(@Req() req: Request, @Body() body: any, @Res() res: Response) {
    const secret = process.env.MP_WEBHOOK_SECRET;

    if (secret) {
      const xSignature = req.headers['x-signature'] as string;
      const xRequestId = req.headers['x-request-id'] as string;

      if (!xSignature) {
        this.logger.warn('Webhook recibido sin x-signature');
        return res.status(401).send('Missing signature');
      }

      const parts = Object.fromEntries(xSignature.split(',').map(p => p.split('=')));
      const ts = parts['ts'];
      const v1 = parts['v1'];

      if (!ts || !v1) {
        return res.status(401).send('Invalid signature format');
      }

      const dataId = body?.data?.id ?? '';
      const manifest = `id:${dataId};request-id:${xRequestId ?? ''};ts:${ts};`;
      const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

      if (expected !== v1) {
        this.logger.warn('Webhook con firma inválida rechazado');
        return res.status(401).send('Invalid signature');
      }
    } else {
      this.logger.warn('MP_WEBHOOK_SECRET no configurado — verificación de firma omitida');
    }

    await this.mpService.handleWebhook(body);
    return res.status(200).send('OK');
  }
}
