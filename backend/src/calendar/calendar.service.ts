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
    // Strip id, userId and audit fields to prevent IDOR / event hijacking via client-supplied PK
    const { id: _id, userId: _uid, createdAt: _ca, ...safeData } = data as any;
    const event = this.eventRepository.create({ ...safeData, userId });
    return this.eventRepository.save(event) as unknown as Promise<CalendarEvent>;
  }

  async update(id: string, data: Partial<CalendarEvent>, userId: string): Promise<CalendarEvent> {
    const event = await this.eventRepository.findOne({ where: { id, userId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    // Strip id, userId and audit fields to prevent mass assignment / ownership reassignment
    const { id: _id, userId: _uid, createdAt: _ca, ...safeData } = data as any;
    Object.assign(event, safeData);
    return this.eventRepository.save(event);
  }

  async remove(id: string, userId: string): Promise<void> {
    const result = await this.eventRepository.delete({ id, userId });
    if (result.affected === 0) throw new NotFoundException('Evento no encontrado');
  }
}
