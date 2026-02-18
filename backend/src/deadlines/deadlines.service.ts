import { Injectable } from '@nestjs/common';
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

  findAll(): Promise<Deadline[]> {
    return this.deadlinesRepository.find({ relations: ['expediente'] });
  }

  findOne(id: string): Promise<Deadline | null> {
    return this.deadlinesRepository.findOne({ where: { id }, relations: ['expediente'] });
  }

  async create(deadline: Partial<Deadline>): Promise<Deadline> {
    const newDeadline = this.deadlinesRepository.create(deadline);
    const savedDeadline = await this.deadlinesRepository.save(newDeadline);

    if (savedDeadline.userId && savedDeadline.fechaVencimiento) {
        // Calendar Sync removed
        // this.calendarService.createEvent(savedDeadline.userId, eventData).catch(err => console.error('Calendar Sync Error', err));
    }

    return savedDeadline;
  }

  async update(id: string, deadline: Partial<Deadline>): Promise<void> {
    await this.deadlinesRepository.update(id, deadline);
    // TODO: Implement update logic for Google Calendar if needed (requires storing Google Event ID)
  }

  async remove(id: string): Promise<void> {
    await this.deadlinesRepository.delete(id);
  }
}
