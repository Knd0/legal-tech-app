import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from './clients.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Client } from './client.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('ClientsService - Pagination & Search', () => {
  let service: ClientsService;
  let repositoryMock: any;
  let queryBuilderMock: any;

  beforeEach(async () => {
    queryBuilderMock = {
      where: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          { id: '1', nombre: 'Juan', apellido: 'Perez', dni: '123' }
        ],
        1
      ]),
    };

    repositoryMock = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
      find: jest.fn().mockResolvedValue([
        { id: '1', nombre: 'Juan', apellido: 'Perez', dni: '123' },
        { id: '2', nombre: 'Maria', apellido: 'Gomez', dni: '456' }
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        {
          provide: getRepositoryToken(Client),
          useValue: repositoryMock,
        },
        {
          provide: AuditLogsService,
          useValue: {
            create: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  it('should return paginated result when page and limit are provided', async () => {
    const result = await service.findAll('user-123', 1, 10, 'Juan');

    expect(repositoryMock.createQueryBuilder).toHaveBeenCalledWith('client');
    expect(queryBuilderMock.where).toHaveBeenCalledWith('client.userId = :userId', { userId: 'user-123' });
    expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(client.nombre) LIKE :search'),
      { search: '%juan%' }
    );
    expect(queryBuilderMock.skip).toHaveBeenCalledWith(0);
    expect(queryBuilderMock.take).toHaveBeenCalledWith(10);
    expect(queryBuilderMock.getManyAndCount).toHaveBeenCalled();

    expect(result).toEqual({
      data: [{ id: '1', nombre: 'Juan', apellido: 'Perez', dni: '123' }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });

  it('should return raw array (fallback) when page and limit are omitted', async () => {
    const result = await service.findAll('user-123');

    expect(repositoryMock.find).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
      relations: ['expedientes'],
      order: { fechaAlta: 'DESC' },
    });
    expect(result).toHaveLength(2);
    expect(result[0].nombre).toBe('Juan');
  });
});
