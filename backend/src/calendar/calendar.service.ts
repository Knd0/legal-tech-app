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

  async create(data: Partial<CalendarEvent>, userId: string): Promise<CalendarEvent> {
    const event = this.eventRepository.create({ ...data, userId });
    return this.eventRepository.save(event);
  }

  async update(id: string, data: Partial<CalendarEvent>, userId: string): Promise<CalendarEvent> {
    const event = await this.eventRepository.findOne({ where: { id, userId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    Object.assign(event, data);
    return this.eventRepository.save(event);
  }

  async remove(id: string, userId: string): Promise<void> {
    const result = await this.eventRepository.delete({ id, userId });
    if (result.affected === 0) throw new NotFoundException('Evento no encontrado');
  }
}
