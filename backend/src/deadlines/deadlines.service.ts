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

  findAll(userId: string): Promise<Deadline[]> {
    return this.deadlinesRepository.find({ where: { userId }, relations: ['expediente'] });
  }

  findOne(id: string, userId: string): Promise<Deadline | null> {
    return this.deadlinesRepository.findOne({ where: { id, userId }, relations: ['expediente'] });
  }

  async create(deadline: Partial<Deadline>, userId: string): Promise<Deadline> {
    const newDeadline = this.deadlinesRepository.create({ ...deadline, userId });
    return this.deadlinesRepository.save(newDeadline);
  }

  async update(id: string, deadline: Partial<Deadline>, userId: string): Promise<void> {
    await this.deadlinesRepository.update({ id, userId }, deadline);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.deadlinesRepository.delete({ id, userId });
  }
}
