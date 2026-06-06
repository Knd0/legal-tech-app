import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deadline } from './deadline.entity';
import { CalendarService } from '../calendar/calendar.service';

@Injectable()
export class DeadlinesService {
  constructor(
    @InjectRepository(Deadline)
    private deadlinesRepository: Repository<Deadline>,
    private calendarService: CalendarService
  ) {}

  findAll(userId?: string): Promise<Deadline[]> {
    const where = userId ? { userId } : {};
    return this.deadlinesRepository.find({ where, relations: ['expediente'] });
  }

  findOne(id: string): Promise<Deadline | null> {
    return this.deadlinesRepository.findOne({ where: { id }, relations: ['expediente'] });
  }

  async create(deadline: Partial<Deadline>): Promise<Deadline> {
    const newDeadline = this.deadlinesRepository.create(deadline);
    const savedDeadline = await this.deadlinesRepository.save(newDeadline);
    return savedDeadline;
  }

  async update(id: string, deadline: Partial<Deadline>): Promise<void> {
    await this.deadlinesRepository.update(id, deadline);
  }

  async remove(id: string): Promise<void> {
    await this.deadlinesRepository.delete(id);
  }

  async analyzePdf(buffer: Buffer): Promise<any> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY no está configurada en las variables de entorno del servidor.');
    }

    const base64Data = buffer.toString('base64');
    const payload = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data
              }
            },
            {
              text: `Eres un asistente legal experto en derecho procesal argentino. Tu tarea es analizar este PDF de notificación judicial y extraer cualquier vencimiento o plazo ordenado.
              Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (no agregues texto explicativo ni formatees con triple acento grave \`\`\`json):
              {
                "titulo": "Título descriptivo del vencimiento (ej: Contestar Demanda, Acompañar Documental)",
                "descripcion": "Resumen muy breve de una sola línea de lo ordenado por el juez",
                "diasHabilesPlazo": número de días hábiles de plazo ordenados (0 si es una fecha fija o no se especifica plazo en días)",
                "fechaNotificacion": "Fecha en que se notifica la resolución en formato YYYY-MM-DD. Si no se indica en el documento, asume la fecha de hoy: ${new Date().toISOString().split('T')[0]}"
              }`
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API de Gemini retornó error ${response.status}: ${errText}`);
      }

      const result = await response.json();
      const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonText) {
        throw new Error('La API de Gemini no retornó contenido en la respuesta.');
      }

      const extracted = JSON.parse(jsonText.trim());
      
      // Calcular fecha final de vencimiento
      const fechaNotif = new Date(extracted.fechaNotificacion);
      // Evitar desajustes de zona horaria local
      fechaNotif.setMinutes(fechaNotif.getMinutes() + fechaNotif.getTimezoneOffset());
      
      const fechaCalculada = this.sumarDiasHabiles(fechaNotif, extracted.diasHabilesPlazo);

      return {
        titulo: extracted.titulo,
        descripcion: extracted.descripcion,
        fechaNotificacion: extracted.fechaNotificacion,
        diasHabilesPlazo: extracted.diasHabilesPlazo,
        fechaVencimiento: fechaCalculada.toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('Error in analyzePdf:', error);
      throw new InternalServerErrorException(`Fallo al analizar la notificación con IA: ${error.message}`);
    }
  }

  sumarDiasHabiles(fechaInicio: Date, dias: number): Date {
    if (dias <= 0) return fechaInicio;
    
    let resultDate = new Date(fechaInicio);
    let daysAdded = 0;
    
    // Feriados nacionales típicos en Argentina (MM-DD)
    const feriados = [
      '01-01', // Año Nuevo
      '03-24', // Memoria
      '04-02', // Malvinas
      '05-01', // Día del Trabajo
      '05-25', // Revolución de Mayo
      '06-20', // Belgrano
      '07-09', // Independencia
      '08-17', // San Martín
      '10-12', // Diversidad Cultural
      '11-20', // Soberanía
      '12-08', // Inmaculada Concepción
      '12-25', // Navidad
    ];

    while (daysAdded < dias) {
      resultDate.setDate(resultDate.getDate() + 1);
      const dayOfWeek = resultDate.getDay(); // 0 = Domingo, 6 = Sábado
      
      const mm = String(resultDate.getMonth() + 1).padStart(2, '0');
      const dd = String(resultDate.getDate()).padStart(2, '0');
      const formattedHoliday = `${mm}-${dd}`;
      
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = feriados.includes(formattedHoliday);
      
      if (!isWeekend && !isHoliday) {
        daysAdded++;
      }
    }
    
    return resultDate;
  }
}
