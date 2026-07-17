import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ExpedientesService } from '../expedientes/expedientes.service';

@Injectable()
export class AiService {
  private openai: OpenAI | null = null;

  constructor(
    private configService: ConfigService,
    private expedientesService: ExpedientesService
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * General helper to query the active AI model.
   * Prioritizes GEMINI_API_KEY (Gemini 1.5 Flash Free Tier) over OPENAI_API_KEY.
   */
  async generateAIResponse(prompt: string): Promise<string> {
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    
    if (geminiKey) {
      try {
        const payload = {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        };
        const geminiModel = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API Error: ${errText}`);
        }

        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text || 'No se recibió respuesta de Gemini.';
      } catch (err: any) {
        console.error('Gemini call error:', err);
        return `[ERROR GEMINI API] Fallo al consultar Gemini: ${err.message}`;
      }
    }

    const isAiEnabled = this.configService.get<string>('AI_ENABLED') === 'true';
    if (isAiEnabled && this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Eres Copilot, un asistente legal experto para un software de gestión jurídica (Themis) de Argentina.'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        });
        return response.choices[0]?.message?.content || 'No se recibió respuesta de OpenAI.';
      } catch (err: any) {
        console.error('OpenAI call error:', err);
        return `[ERROR OPENAI API] Fallo al consultar OpenAI: ${err.message}`;
      }
    }

    return `[MÓDULO IA DESACTIVADO]\n\nCopilot no está configurado.\n\nPara activarlo de forma gratuita, configure la variable de entorno 'GEMINI_API_KEY' en su panel de Railway con una clave de Google AI Studio (https://aistudio.google.com/).`;
  }

  async analyze(text: string, context?: string): Promise<{ analysis: string }> {
    const prompt = `Realiza un análisis profesional para el siguiente escrito.\nContexto o Tipo de Análisis solicitado: ${context || 'General'}\n\nEscrito o consulta:\n${text}`;
    const analysis = await this.generateAIResponse(prompt);
    return { analysis };
  }

  async generateDraft(expedienteId: string, tipoEscrito: string, extraInstructions?: string, userId?: string): Promise<{ draft: string }> {
    const exp = await this.expedientesService.findOne(expedienteId, userId);
    if (!exp) {
      throw new Error('Expediente no encontrado.');
    }

    const prompt = `Eres un abogado procesal de Argentina experto en redacción de escritos judiciales.
    Redacta un escrito judicial formal de tipo "${tipoEscrito}" para presentar ante el juzgado correspondiente con los siguientes detalles del expediente:
    - Carátula: ${exp.caratula}
    - Nro de Expediente: ${exp.nroExpediente}
    - Juzgado/Secretaría: ${exp.juzgado} (${exp.secretaria || 'No especificada'}) - Fuero: ${exp.fuero}
    - Cliente representado: ${exp.cliente?.nombre || 'No especificado'} (DNI/CUIT: ${(exp.cliente?.cuit || exp.cliente?.dni) || 'No especificado'})
    - Contraparte: ${exp.contraparte || 'No especificado'}
    - Abogado de la contraparte: ${exp.abogadoContraparte || 'No especificado'}
    - Detalles/Descripción del caso: ${exp.descripcion || 'Sin descripción adicional'}

    Instrucciones específicas de redacción:
    - Utiliza la estructura forense estándar argentina: OBJETO, HECHOS, PRUEBA (si corresponde), DERECHO, PETITORIO.
    - Usa fórmulas de cortesía procesales formales ("S. S.", "Proveer de conformidad", "Será Justicia").
    - Completa los datos con la información provista, e indica entre corchetes (ej: [COMPLETAR DNI]) donde falten datos para rellenar después.
    ${extraInstructions ? `- Instrucciones adicionales del usuario: ${extraInstructions}` : ''}

    Devuelve ÚNICAMENTE el escrito redactado formateado con Markdown limpio.`;

    const draft = await this.generateAIResponse(prompt);
    return { draft };
  }

  async summarizeExpediente(expedienteId: string, userId: string): Promise<{ summary: string }> {
    const exp = await this.expedientesService.findOne(expedienteId, userId);
    if (!exp) {
      throw new Error('Expediente no encontrado.');
    }

    const prompt = `Analiza y redacta un resumen procesal ejecutivo y estratégico sobre el siguiente expediente judicial:
    - Carátula: ${exp.caratula}
    - Expediente Nro: ${exp.nroExpediente}
    - Fuero: ${exp.fuero}
    - Juzgado: ${exp.juzgado} (Secretaría: ${exp.secretaria || 'No especificada'})
    - Estado Procesal Actual: ${exp.estado}
    - Cliente: ${exp.cliente?.nombre || 'No especificado'}
    - Contraparte: ${exp.contraparte || 'No especificado'}
    - Detalles/Descripción del caso: ${exp.descripcion || 'Sin detalles adicionales'}

    El resumen debe ser directo y constar de:
    1. **Resumen del Conflicto**: Qué se disputa en este expediente.
    2. **Análisis del Estado Procesal**: En qué etapa del juicio nos encontramos (${exp.estado}) y qué significa para el cliente.
    3. **Plan de Acción Sugerido**: Acciones estratégicas y plazos procesales recomendados que el abogado debería ejecutar a continuación.

    Devuelve el resumen en Markdown limpio y profesional.`;

    const summary = await this.generateAIResponse(prompt);
    return { summary };
  }

  async analyzeRisk(expedienteId: string, userId: string): Promise<{ riskAnalysis: string; successProbability: number; weakPoints: string[]; strongPoints: string[] }> {
    const exp = await this.expedientesService.findOne(expedienteId, userId);
    if (!exp) {
      throw new Error('Expediente no encontrado.');
    }

    const prompt = `Realiza un análisis de riesgo procesal y una estimación de probabilidad de éxito para el siguiente caso judicial en Argentina:
    - Carátula: ${exp.caratula}
    - Fuero/Juzgado: ${exp.fuero} / ${exp.juzgado}
    - Estado actual: ${exp.estado}
    - Descripción del caso: ${exp.descripcion || 'Sin descripción cargada'}

    Debes responder ÚNICAMENTE con un JSON válido estructurado con el siguiente esquema (no envíes markdown, no envíes triple acento grave):
    {
      "riskAnalysisMarkdown": "Un análisis legal detallado en Markdown sobre los puntos clave, pruebas requeridas, jurisprudencia y riesgos de este caso.",
      "successProbability": número entero de 0 a 100 indicando la probabilidad de éxito (ej: 75),
      "strongPoints": ["Punto fuerte 1", "Punto fuerte 2", ...],
      "weakPoints": ["Punto débil 1", "Punto débil 2", ...]
    }`;

    const responseText = await this.generateAIResponse(prompt);
    
    try {
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        riskAnalysis: parsed.riskAnalysisMarkdown || parsed.riskAnalysis || 'Análisis completado.',
        successProbability: parsed.successProbability !== undefined ? Number(parsed.successProbability) : 50,
        strongPoints: parsed.strongPoints || [],
        weakPoints: parsed.weakPoints || []
      };
    } catch (e) {
      console.warn('Fallo al parsear JSON de riesgo, usando fallback:', e);
      return {
        riskAnalysis: responseText,
        successProbability: 50,
        strongPoints: ['Expediente en curso activo'],
        weakPoints: ['Jurisprudencia local variable']
      };
    }
  }

  async analyzeCosts(data: {
    montoReclamo: number;
    jurisdiccion: string;
    tipoProceso: string;
    requiereMediacion: boolean;
    requierePerito: boolean;
    cantidadNotificaciones: number;
    extraDetails?: string;
    valorJus: number;
    valorUma: number;
  }): Promise<{ analysis: string }> {
    const prompt = `Eres un abogado procesal de Argentina experto en cálculo y análisis predictivo de costos judiciales.
    Realiza un análisis detallado sobre la viabilidad económica y costos estimados para un posible litigio judicial con los siguientes parámetros:
    - Monto del Reclamo: $${(data.montoReclamo || 0).toLocaleString('es-AR')} ARS
    - Jurisdicción: ${data.jurisdiccion.toUpperCase()}
    - Tipo de Proceso/Fuero: ${data.tipoProceso.toUpperCase()}
    - Requiere Mediación Previa: ${data.requiereMediacion ? 'Sí' : 'No'}
    - Requiere Peritajes: ${data.requierePerito ? 'Sí' : 'No'}
    - Cantidad Estimada de Notificaciones: ${data.cantidadNotificaciones}
    - Valor JUS de referencia: $${(data.valorJus || 0).toLocaleString('es-AR')} ARS
    - Valor UMA de referencia: $${(data.valorUma || 0).toLocaleString('es-AR')} ARS
    ${data.extraDetails ? `- Detalles/Estrategia adicionales brindados: ${data.extraDetails}` : ''}

    Estructura tu respuesta en Markdown limpio y profesional con las siguientes secciones:
    1. **Resumen de Viabilidad Económica**: Un análisis de costo-beneficio de litigar versus la probabilidad de éxito o la posibilidad de un acuerdo extrajudicial.
    2. **Estructura Impositiva Aplicable**: Comenta los aranceles de tasas de justicia y sobretasas correspondientes a la jurisdicción seleccionada (${data.jurisdiccion.toUpperCase()}).
    3. **Impacto de los Honorarios**: Explica las escalas arancelarias de la ley de honorarios local para abogados y peritos involucrados.
    4. **Recomendación y Mitigación de Costos**: Sugiere formas de disminuir gastos (beneficio de litigar sin gastos, convenios de cuota litis, tasas reducidas o mediación efectiva).

    Devuelve ÚNICAMENTE el análisis en Markdown.`;

    const analysis = await this.generateAIResponse(prompt);
    return { analysis };
  }
}
