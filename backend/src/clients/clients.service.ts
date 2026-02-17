import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './client.entity';

import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
    private auditLogsService: AuditLogsService,
  ) {}

  async findAll(userId: string): Promise<Client[]> {
    return this.clientsRepository.find({ where: { userId }, relations: ['expedientes'] });
  }

  async findOne(id: string, userId: string): Promise<Client | null> {
    return this.clientsRepository.findOne({ where: { id, userId }, relations: ['expedientes'] });
  }

  async create(client: Partial<Client>, userId: string): Promise<Client> {
    const newClient = this.clientsRepository.create({ ...client, userId });
    const savedClient = await this.clientsRepository.save(newClient);
    await this.auditLogsService.log(userId, 'CREATE', 'CLIENT', savedClient.id, `Created client ${savedClient.nombre} ${savedClient.apellido}`);
    return savedClient;
  }

  async update(id: string, client: Partial<Client>, userId: string): Promise<void> {
    await this.clientsRepository.update({ id, userId }, client);
    await this.auditLogsService.log(userId, 'UPDATE', 'CLIENT', id, `Updated client`);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.clientsRepository.delete({ id, userId });
    await this.auditLogsService.log(userId, 'DELETE', 'CLIENT', id, `Deleted client`);
  }
}
