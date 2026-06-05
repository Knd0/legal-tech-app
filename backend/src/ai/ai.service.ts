import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private openai: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async analyze(text: string, context?: string): Promise<{ analysis: string }> {
    const isAiEnabled = this.configService.get<string>('AI_ENABLED') === 'true';

    if (!isAiEnabled || !this.openai) {
      return {
        analysis: `[MÓDULO IA DESACTIVADO]\n\nEl Copiloto Legal de Inteligencia Artificial no está configurado o está deshabilitado en este momento.\n\nPara activarlo en el archivo .env de su backend:\n1. Configure 'OPENAI_API_KEY=tu_clave_de_openai'\n2. Configure 'AI_ENABLED=true'\n\nTexto recibido para analizar (${text.length} caracteres):\n"${text.substring(0, 150)}..."`
      };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un copiloto legal experto para un software de gestión jurídica (LegalTech). Tu labor es analizar escritos, resumir expedientes, corregir cláusulas contractuales o proponer redacciones profesionales fundamentadas en el derecho.`
          },
          {
            role: 'user',
            content: `Realiza un análisis profesional para el siguiente escrito.\nContexto o Tipo de Análisis solicitado: ${context || 'General'}\n\nEscrito o consulta:\n${text}`
          }
        ]
      });

      return {
        analysis: response.choices[0]?.message?.content || 'No se recibió respuesta de OpenAI.'
      };
    } catch (error: any) {
      console.error('OpenAI API Error:', error);
      return {
        analysis: `[ERROR OPENAI]\nNo se pudo obtener el análisis debido a un error de comunicación con la API de OpenAI:\n${error.message || error}`
      };
    }
  }
}
