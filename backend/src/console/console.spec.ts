import { NotFoundException } from '@nestjs/common';
import { ConsoleKeyGuard } from './console-key.guard';
import { deriveTenantStatus, GRACE_PERIOD_MS } from './console.service';

const KEY = 'k'.repeat(40);

function ctx(headers: Record<string, string>) {
  return { switchToHttp: () => ({ getRequest: () => ({ headers }) }) } as any;
}

describe('ConsoleKeyGuard', () => {
  const ORIGINAL = process.env.CONSOLE_API_KEY;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CONSOLE_API_KEY;
    else process.env.CONSOLE_API_KEY = ORIGINAL;
  });

  it('sin CONSOLE_API_KEY la API no existe (404), aunque manden algo', () => {
    delete process.env.CONSOLE_API_KEY;
    expect(() => new ConsoleKeyGuard().canActivate(ctx({ 'x-console-key': KEY }))).toThrow(NotFoundException);
  });

  it('rechaza claves cortas configuradas por error', () => {
    process.env.CONSOLE_API_KEY = 'corta';
    expect(() => new ConsoleKeyGuard().canActivate(ctx({ 'x-console-key': 'corta' }))).toThrow(NotFoundException);
  });

  it('rechaza sin encabezado o con clave incorrecta', () => {
    process.env.CONSOLE_API_KEY = KEY;
    expect(() => new ConsoleKeyGuard().canActivate(ctx({}))).toThrow(NotFoundException);
    expect(() => new ConsoleKeyGuard().canActivate(ctx({ 'x-console-key': 'x'.repeat(40) }))).toThrow(NotFoundException);
  });

  it('deja pasar con la clave exacta', () => {
    process.env.CONSOLE_API_KEY = KEY;
    expect(new ConsoleKeyGuard().canActivate(ctx({ 'x-console-key': KEY }))).toBe(true);
  });
});

describe('deriveTenantStatus', () => {
  const now = new Date('2026-10-21T12:00:00Z');
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  it('suspendido manda sobre todo', () => {
    expect(deriveTenantStatus(false, { subscriptionStatus: 'active', subscriptionExpiresAt: null }, now)).toBe('suspended');
  });

  it('activo y al día', () => {
    expect(deriveTenantStatus(true, { subscriptionStatus: 'active', subscriptionExpiresAt: daysAgo(-10) }, now)).toBe('active');
  });

  it('vencido hace menos de 7 días está en gracia', () => {
    expect(deriveTenantStatus(true, { subscriptionStatus: 'active', subscriptionExpiresAt: daysAgo(3) }, now)).toBe('grace');
  });

  it('vencido hace más de 7 días', () => {
    const expiresAt = new Date(now.getTime() - GRACE_PERIOD_MS - 1000);
    expect(deriveTenantStatus(true, { subscriptionStatus: 'active', subscriptionExpiresAt: expiresAt }, now)).toBe('expired');
  });

  it('sin suscripción cuenta como prueba', () => {
    expect(deriveTenantStatus(true, null, now)).toBe('trial');
  });

  it('respeta pausada y cancelada', () => {
    expect(deriveTenantStatus(true, { subscriptionStatus: 'paused', subscriptionExpiresAt: null }, now)).toBe('paused');
    expect(deriveTenantStatus(true, { subscriptionStatus: 'cancelled', subscriptionExpiresAt: null }, now)).toBe('cancelled');
  });
});
