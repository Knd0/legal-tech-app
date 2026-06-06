import { Controller, Post, Body, UseGuards, BadRequestException, Request } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze')
  async analyze(@Body() body: { text: string; context?: string }) {
    if (!body || typeof body.text !== 'string' || body.text.trim() === '') {
      throw new BadRequestException('El texto a analizar es requerido.');
    }
    return this.aiService.analyze(body.text, body.context);
  }

  @Post('draft')
  async draft(@Body() body: { expedienteId: string; tipoEscrito: string; extraInstructions?: string }, @Request() req) {
    if (!body.expedienteId || !body.tipoEscrito) {
      throw new BadRequestException('expedienteId y tipoEscrito son requeridos.');
    }
    return this.aiService.generateDraft(body.expedienteId, body.tipoEscrito, body.extraInstructions, req.user.userId);
  }

  @Post('summarize-expediente')
  async summarizeExpediente(@Body() body: { expedienteId: string }, @Request() req) {
    if (!body.expedienteId) {
      throw new BadRequestException('expedienteId es requerido.');
    }
    return this.aiService.summarizeExpediente(body.expedienteId, req.user.userId);
  }

  @Post('analyze-risk')
  async analyzeRisk(@Body() body: { expedienteId: string }, @Request() req) {
    if (!body.expedienteId) {
      throw new BadRequestException('expedienteId es requerido.');
    }
    return this.aiService.analyzeRisk(body.expedienteId, req.user.userId);
  }

  @Post('analyze-costs')
  async analyzeCosts(@Body() body: {
    montoReclamo: number;
    jurisdiccion: string;
    tipoProceso: string;
    requiereMediacion: boolean;
    requierePerito: boolean;
    cantidadNotificaciones: number;
    extraDetails?: string;
    valorJus: number;
    valorUma: number;
  }) {
    if (body.montoReclamo === undefined || !body.jurisdiccion || !body.tipoProceso) {
      throw new BadRequestException('montoReclamo, jurisdiccion y tipoProceso son requeridos.');
    }
    return this.aiService.analyzeCosts(body);
  }
}
