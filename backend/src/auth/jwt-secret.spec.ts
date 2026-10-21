import { resolveJwtSecret } from './jwt-secret';

describe('resolveJwtSecret', () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV;
  });

  it('devuelve el secreto configurado', () => {
    expect(resolveJwtSecret('un-secreto-largo')).toBe('un-secreto-largo');
  });

  it('falla al arrancar si falta JWT_SECRET fuera de los tests', () => {
    process.env.NODE_ENV = 'production';
    expect(() => resolveJwtSecret(undefined)).toThrow(/JWT_SECRET/);
    expect(() => resolveJwtSecret('   ')).toThrow(/JWT_SECRET/);
  });

  it('nunca vuelve al viejo fallback público "secretKey"', () => {
    process.env.NODE_ENV = 'development';
    expect(() => resolveJwtSecret('')).toThrow();
  });

  it('en tests usa un secreto fijo para no depender del entorno', () => {
    process.env.NODE_ENV = 'test';
    expect(resolveJwtSecret(undefined)).toBe('test-only-jwt-secret');
  });
});
