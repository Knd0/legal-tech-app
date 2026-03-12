import { Controller, Post, Body, Req, Res, Get, UseGuards } from '@nestjs/common';
import { MercadopagoService } from './mercadopago.service';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('mercadopago')
export class MercadopagoController {
  constructor(private readonly mpService: MercadopagoService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create-subscription')
  async createSubscription(@Req() req, @Res() res: Response) {
    try {
      const user = req.user; // from JWT
      // Provide a link for the user to subscribe
      const result = await this.mpService.createSubscriptionForUser(user.userId, user.email);
      return res.status(200).json({ preapprovalLink: result.init_point });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Post('webhook')
  async handleWebhook(@Body() body: any, @Res() res: Response) {
      // MercadoPago sends notifications to this endpoint
      await this.mpService.handleWebhook(body);
      return res.status(200).send('OK');
  }
}
