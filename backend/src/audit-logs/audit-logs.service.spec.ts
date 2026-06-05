import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsService } from './audit-logs.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditLogsService - Pagination', () => {
  let service: AuditLogsService;
  let repositoryMock: any;

  beforeEach(async () => {
    repositoryMock = {
      findAndCount: jest.fn().mockResolvedValue([
        [
          { id: '1', action: 'CREATE', entityType: 'CLIENT', userId: 'user-123', details: 'Created test' }
        ],
        1
      ]),
      find: jest.fn().mockResolvedValue([
        { id: '1', action: 'CREATE', entityType: 'CLIENT', userId: 'user-123', details: 'Created test' },
        { id: '2', action: 'UPDATE', entityType: 'CLIENT', userId: 'user-123', details: 'Updated test' }
      ]),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((log) => Promise.resolve({ id: 'new-log-id', ...log })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: repositoryMock,
        },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  it('should return paginated audit logs when page and limit are provided', async () => {
    const result = await service.findAll('user-123', 1, 10);

    expect(repositoryMock.findAndCount).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
      order: { createdAt: 'DESC' },
      skip: 0,
      take: 10,
    });

    expect(result).toEqual({
      data: [{ id: '1', action: 'CREATE', entityType: 'CLIENT', userId: 'user-123', details: 'Created test' }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });

  it('should return recent 20 logs when page and limit are omitted', async () => {
    const result = await service.findAll('user-123');

    expect(repositoryMock.find).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    expect(result).toHaveLength(2);
  });

  it('should return recent 5 logs in findRecent', async () => {
    const result = await service.findRecent('user-123');

    expect(repositoryMock.find).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
      order: { createdAt: 'DESC' },
      take: 5,
    });
    expect(result).toHaveLength(2);
  });
});
