import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Subscription } from './entities/subscription.entity';

/**
 * Cobertura de regresión para la escalada de privilegios vía `PATCH /users/profile`:
 * el body llegaba sin filtrar a `usersRepository.update()`, que escribe cualquier
 * columna de la entidad — incluida `role`.
 */
describe('UsersService.updateProfile', () => {
  let service: UsersService;
  let usersRepo: any;

  const existingUser = {
    id: 'user-1',
    role: 'USER',
    isActive: true,
    phoneNumber: '+5491100000000',
    afipKey: 'CLAVE-EXISTENTE',
  };

  beforeEach(async () => {
    usersRepo = {
      findOne: jest.fn().mockResolvedValue(existingUser),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
      metadata: { columns: [] },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Subscription), useValue: { findOne: jest.fn(), create: jest.fn(), save: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  const updatedFields = () => usersRepo.update.mock.calls[0][1];

  it('ignora role: un USER no puede promoverse a ADMIN', async () => {
    await service.updateProfile('user-1', { fullName: 'Nuevo Nombre', role: 'ADMIN' });

    expect(updatedFields()).not.toHaveProperty('role');
    expect(updatedFields().fullName).toBe('Nuevo Nombre');
  });

  it('ignora isActive: un usuario suspendido no puede reactivarse solo', async () => {
    await service.updateProfile('user-1', { address: 'Calle 1', isActive: true });

    expect(updatedFields()).not.toHaveProperty('isActive');
  });

  it('ignora passwordHash y email enviados desde el cliente', async () => {
    await service.updateProfile('user-1', {
      fullName: 'X',
      passwordHash: '$2b$10$hashinyectado',
      email: 'otro@dominio.com',
    });

    expect(updatedFields()).not.toHaveProperty('passwordHash');
    expect(updatedFields()).not.toHaveProperty('email');
  });

  it('no permite marcarse el teléfono como verificado', async () => {
    await service.updateProfile('user-1', { isPhoneVerified: true });

    // Sin cambio de número, `isPhoneVerified` no debe aparecer en el update.
    expect(usersRepo.update).not.toHaveBeenCalled();
  });

  it('invalida la verificación cuando cambia el número de teléfono', async () => {
    await service.updateProfile('user-1', { phoneNumber: '+5491199999999' });

    expect(updatedFields().isPhoneVerified).toBe(false);
  });

  it('descarta secretos vacíos para no borrar la clave AFIP ya cargada', async () => {
    await service.updateProfile('user-1', { cuit: '20-11111111-2', afipKey: '', pjnPassword: '' });

    expect(updatedFields()).not.toHaveProperty('afipKey');
    expect(updatedFields()).not.toHaveProperty('pjnPassword');
    expect(updatedFields().cuit).toBe('20-11111111-2');
  });

  it('acepta null explícito para desvincular AFIP', async () => {
    await service.updateProfile('user-1', { afipCert: null, afipKey: null, cuit: null });

    expect(updatedFields().afipKey).toBeNull();
    expect(updatedFields().afipCert).toBeNull();
  });

  it('no escribe nada si el body sólo trae campos no editables', async () => {
    await service.updateProfile('user-1', { role: 'ADMIN', id: 'otro-id', createdAt: new Date() });

    expect(usersRepo.update).not.toHaveBeenCalled();
  });
});
