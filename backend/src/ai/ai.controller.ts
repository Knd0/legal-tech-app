import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
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
}
