import { Test, TestingModule } from '@nestjs/testing';
import { FacturasService } from './facturas.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Factura } from './entities/factura.entity';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

describe('FacturasService - Pagination', () => {
  let service: FacturasService;
  let usersService: UsersService;
  let repositoryMock: any;

  beforeEach(async () => {
    repositoryMock = {
      findAndCount: jest.fn().mockResolvedValue([
        [
          { id: '1', nroCbte: 123, impTotal: 5000, cae: 'CAE123', clientId: 'client-1' }
        ],
        1
      ]),
      find: jest.fn().mockResolvedValue([
        { id: '1', nroCbte: 123, impTotal: 5000, cae: 'CAE123', clientId: 'client-1' },
        { id: '2', nroCbte: 124, impTotal: 8000, cae: 'CAE124', clientId: 'client-1' }
      ]),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((factura) => Promise.resolve({ id: 'new-id', ...factura })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacturasService,
        {
          provide: getRepositoryToken(Factura),
          useValue: repositoryMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'AFIP_CUIT') return '20123456789';
              return null;
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOneById: jest.fn().mockResolvedValue({ id: 'user-1', puntoVenta: 1 }),
          },
        },
      ],
    }).compile();

    service = module.get<FacturasService>(FacturasService);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should return paginated all invoices when page and limit are provided', async () => {
    const result = await service.findAll(1, 10);

    expect(repositoryMock.findAndCount).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      skip: 0,
      take: 10,
    });

    expect(result).toEqual({
      data: [{ id: '1', nroCbte: 123, impTotal: 5000, cae: 'CAE123', clientId: 'client-1' }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });

  it('should return all invoices when page and limit are omitted in findAll', async () => {
    const result = await service.findAll();

    expect(repositoryMock.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
    });
    expect(result).toHaveLength(2);
  });

  it('should return paginated invoices for a client when page and limit are provided', async () => {
    const result = await service.findByClient('client-1', 1, 10);

    expect(repositoryMock.findAndCount).toHaveBeenCalledWith({
      where: { clientId: 'client-1' },
      order: { createdAt: 'DESC' },
      skip: 0,
      take: 10,
    });

    expect(result).toEqual({
      data: [{ id: '1', nroCbte: 123, impTotal: 5000, cae: 'CAE123', clientId: 'client-1' }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });

  it('should return client invoices when page and limit are omitted in findByClient', async () => {
    const result = await service.findByClient('client-1');

    expect(repositoryMock.find).toHaveBeenCalledWith({
      where: { clientId: 'client-1' },
      order: { createdAt: 'DESC' },
    });
    expect(result).toHaveLength(2);
  });

  it('should create simulated invoice with user custom puntoVenta', async () => {
    (service as any).afip = null; // Force simulation mode
    jest.spyOn(usersService, 'findOneById').mockResolvedValue({ id: 'user-1', puntoVenta: 5 } as any);

    const result = await service.createFactura({ total: 12000, clientId: 'client-1' }, 'user-1');

    expect(result.puntoVenta).toBe(5);
    expect(repositoryMock.create).toHaveBeenCalledWith(expect.objectContaining({
      puntoVenta: 5,
      impTotal: 12000,
    }));
  });
});
