import {
  pickSelfEditableFields,
  sanitizeAndFlattenUser,
  sanitizeUser,
} from './user-response.util';

describe('sanitizeUser', () => {
  const user = {
    id: 'user-1',
    email: 'abogado@estudio.com',
    fullName: 'Abogada',
    passwordHash: '$2b$10$abc',
    afipCert: '-----BEGIN CERTIFICATE-----',
    afipKey: '-----BEGIN PRIVATE KEY-----',
    pjnUser: 'jdoe',
    pjnPassword: 'secreta',
    mevUser: 'jdoe-mev',
    mevPassword: 'secreta-mev',
  };

  it('no devuelve el hash de contraseña ni credenciales operativas', () => {
    const result = sanitizeUser(user);

    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('afipKey');
    expect(result).not.toHaveProperty('pjnPassword');
    expect(result).not.toHaveProperty('mevPassword');
  });

  it('conserva los datos no sensibles', () => {
    const result = sanitizeUser(user);

    expect(result.email).toBe('abogado@estudio.com');
    expect(result.fullName).toBe('Abogada');
    // El certificado es público (la clave privada es lo que no debe salir).
    expect(result.afipCert).toBe('-----BEGIN CERTIFICATE-----');
  });

  it('expone banderas para que la UI sepa qué credenciales hay cargadas', () => {
    const result = sanitizeUser(user);

    expect(result.hasAfipKey).toBe(true);
    expect(result.hasPjnCredentials).toBe(true);
    expect(result.hasMevCredentials).toBe(true);
  });

  it('devuelve banderas en false cuando no hay credenciales', () => {
    const result = sanitizeUser({ id: 'user-2', email: 'x@y.com' });

    expect(result.hasAfipKey).toBe(false);
    expect(result.hasPjnCredentials).toBe(false);
  });

  it('no muta el objeto original', () => {
    sanitizeUser(user);
    expect(user.passwordHash).toBe('$2b$10$abc');
  });

  it('devuelve null para entradas vacías', () => {
    expect(sanitizeUser(null)).toBeNull();
    expect(sanitizeUser(undefined)).toBeNull();
  });
});

describe('sanitizeAndFlattenUser', () => {
  it('aplana la suscripción y sigue ocultando los secretos', () => {
    const result = sanitizeAndFlattenUser({
      id: 'user-1',
      passwordHash: 'hash',
      afipKey: 'clave',
      subscription: {
        subscriptionStatus: 'active',
        subscriptionExpiresAt: new Date('2027-01-01'),
        mpSubscriptionId: 'mp-1',
        subscriptionPlan: 'pro',
      },
    });

    expect(result.subscriptionStatus).toBe('active');
    expect(result.mpSubscriptionId).toBe('mp-1');
    expect(result).not.toHaveProperty('subscription');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('afipKey');
  });

  it('usa valores por defecto cuando no hay suscripción', () => {
    const result = sanitizeAndFlattenUser({ id: 'user-1', subscription: null });

    expect(result.subscriptionStatus).toBe('trial');
    expect(result.subscriptionExpiresAt).toBeNull();
    expect(result.subscriptionPlan).toBe('pro');
  });
});

describe('pickSelfEditableFields', () => {
  it('conserva sólo los campos que el usuario puede editar de sí mismo', () => {
    const result = pickSelfEditableFields({
      fullName: 'Nombre',
      alertWhatsapp: false,
      role: 'ADMIN',
      isActive: false,
      passwordHash: 'hash',
      id: 'otro-id',
    });

    expect(result).toEqual({ fullName: 'Nombre', alertWhatsapp: false });
  });

  it('conserva valores falsy legítimos', () => {
    const result = pickSelfEditableFields({ daysBeforeAlert: 0, alertPush: false, cuit: null });

    expect(result).toEqual({ daysBeforeAlert: 0, alertPush: false, cuit: null });
  });

  it('tolera entradas que no son objetos', () => {
    expect(pickSelfEditableFields(null as any)).toEqual({});
    expect(pickSelfEditableFields('texto' as any)).toEqual({});
  });
});
