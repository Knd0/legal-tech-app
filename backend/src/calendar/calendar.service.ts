import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarEvent } from './calendar-event.entity';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEvent)
    private eventRepository: Repository<CalendarEvent>,
  ) {}

  findAll(userId: string): Promise<CalendarEvent[]> {
    return this.eventRepository.find({
      where: { userId },
      order: { fecha: 'ASC' },
    });
  }

  private sanitize(data: any): Partial<CalendarEvent> {
    // Allowlist: only accept writable domain fields, never ownership or PK fields
    const { titulo, descripcion, fecha, fechaFin, tipo, color } = data;
    return { titulo, descripcion, fecha, fechaFin, tipo, color };
  }

  async create(data: Partial<CalendarEvent>, userId: string): Promise<CalendarEvent> {
    const event = this.eventRepository.create({ ...this.sanitize(data), userId });
    return this.eventRepository.save(event) as unknown as Promise<CalendarEvent>;
  }

  async update(id: string, data: Partial<CalendarEvent>, userId: string): Promise<CalendarEvent> {
    const event = await this.eventRepository.findOne({ where: { id, userId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    Object.assign(event, this.sanitize(data));
    return this.eventRepository.save(event);
  }

  async remove(id: string, userId: string): Promise<void> {
    const result = await this.eventRepository.delete({ id, userId });
    if (result.affected === 0) throw new NotFoundException('Evento no encontrado');
  }
}
