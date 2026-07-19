import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket } from './entities/support-ticket.entity';

@Injectable()
export class SupportTicketsService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly supportTicketRepository: Repository<SupportTicket>,
  ) {}

  async create(asunto: string, descripcion: string, userId: string): Promise<SupportTicket> {
    const ticket = this.supportTicketRepository.create({
      asunto,
      descripcion,
      status: 'open',
      userId,
    });
    return this.supportTicketRepository.save(ticket);
  }

  async findAll(): Promise<SupportTicket[]> {
    return this.supportTicketRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async resolve(id: string): Promise<SupportTicket> {
    const ticket = await this.supportTicketRepository.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Ticket de soporte con ID ${id} no encontrado`);
    }
    ticket.status = 'resolved';
    return this.supportTicketRepository.save(ticket);
  }
}
