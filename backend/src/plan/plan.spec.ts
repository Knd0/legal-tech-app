import { ForbiddenException, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { computeAccess, GRACE_PERIOD_DAYS, trialExpiry, TRIAL_DAYS } from './plan-policy';
import { PlanAccessInterceptor } from './plan-access.interceptor';
import { ALLOW_WITHOUT_SUBSCRIPTION, PLAN_LIMIT, REQUIRES_FEATURE } from './plan.decorators';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-21T12:00:00Z');
const at = (days: number) => new Date(now.getTime() + days * DAY);

describe('computeAccess', () => {
  it('la prueba da todo lo del plan Profesional hasta que vence', () => {
    const a = computeAccess({ subscriptionStatus: 'trial', subscriptionPlan: 'basic', subscriptionExpiresAt: at(3) }, false, now);
    expect(a).toMatchObject({ state: 'trial', canWrite: true, effectivePlan: 'pro', daysLeft: 3 });
    expect(a.features.ai).toBe(true);
    expect(a.limits.clientes).toBeNull();
  });

  it('Básico activo: límites de 10 clientes y 15 expedientes, sin IA ni AFIP', () => {
    const a = computeAccess({ subscriptionStatus: 'active', subscriptionPlan: 'basic', subscriptionExpiresAt: at(20) }, false, now);
    expect(a.limits).toEqual({ clientes: 10, expedientes: 15 });
    expect(a.features).toEqual({ ai: false, afip: false, whatsapp: false });
  });

  it('vencida: 7 días de gracia de sólo lectura y después bloqueo', () => {
    expect(computeAccess({ subscriptionStatus: 'active', subscriptionExpiresAt: at(-2) }, false, now)).toMatchObject({ state: 'grace', canWrite: false });
    expect(computeAccess({ subscriptionStatus: 'active', subscriptionExpiresAt: at(-(GRACE_PERIOD_DAYS + 1)) }, false, now)).toMatchObject({ state: 'expired', canWrite: false });
  });

  it('pausada o cancelada no puede cargar datos', () => {
    expect(computeAccess({ subscriptionStatus: 'paused', subscriptionExpiresAt: at(10) }, false, now)).toMatchObject({ state: 'inactive', canWrite: false });
  });

  it('el ADMIN siempre tiene todo', () => {
    expect(computeAccess({ subscriptionStatus: 'cancelled' }, true, now)).toMatchObject({ canWrite: true, effectivePlan: 'pro' });
  });

  it('una prueba nueva dura 14 días', () => {
    expect(trialExpiry(now).getTime() - now.getTime()).toBe(TRIAL_DAYS * DAY);
  });
});

describe('PlanAccessInterceptor', () => {
  function setup(sub: any, meta: Record<string, any> = {}, count = 0) {
    const reflector = { getAllAndOverride: (key: string) => meta[key] } as unknown as Reflector;
    const plans: any = {
      accessFor: jest.fn(async (_id: string, isAdmin: boolean) => computeAccess(sub, isAdmin)),
      count: jest.fn(async () => count),
    };
    const interceptor = new PlanAccessInterceptor(reflector, plans);
    const run = (method: string, user: any = { userId: 'u1', role: 'USER' }) => {
      const ctx: any = {
        getType: () => 'http',
        getHandler: () => null,
        getClass: () => null,
        switchToHttp: () => ({ getRequest: () => ({ method, user }) }),
      };
      const next = { handle: jest.fn(() => of('ok')) };
      return interceptor.intercept(ctx, next).then((obs) => lastValueFrom(obs)).then((r) => ({ r, next }));
    };
    return { run, plans };
  }
  const vencida = { subscriptionStatus: 'active', subscriptionPlan: 'pro', subscriptionExpiresAt: at(-30) };
  const basico = { subscriptionStatus: 'active', subscriptionPlan: 'basic', subscriptionExpiresAt: at(30) };

  it('con la suscripción vencida responde 402 a cualquier escritura', async () => {
    const { run } = setup(vencida);
    await expect(run('POST')).rejects.toMatchObject({ status: 402 });
  });

  it('pero deja leer', async () => {
    const { run } = setup(vencida);
    await expect(run('GET')).resolves.toMatchObject({ r: 'ok' });
  });

  it('y deja escribir en rutas permitidas (perfil, pagos, soporte)', async () => {
    const { run } = setup(vencida, { [ALLOW_WITHOUT_SUBSCRIPTION]: true });
    await expect(run('PATCH')).resolves.toMatchObject({ r: 'ok' });
  });

  it('el Básico no puede usar la IA aunque llame directo a la API', async () => {
    const { run } = setup(basico, { [REQUIRES_FEATURE]: 'ai' });
    await expect(run('POST')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el Básico no puede pasar de 10 clientes (cuenta en la base, no en la pantalla)', async () => {
    const lleno = setup(basico, { [PLAN_LIMIT]: 'clientes' }, 10);
    await expect(lleno.run('POST')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PLAN_LIMIT', limit: 10 }) });
    const conLugar = setup(basico, { [PLAN_LIMIT]: 'clientes' }, 9);
    await expect(conLugar.run('POST')).resolves.toMatchObject({ r: 'ok' });
  });

  it('sin sesión no interviene (rutas públicas)', async () => {
    const { run, plans } = setup(vencida);
    await expect(run('POST', null)).resolves.toMatchObject({ r: 'ok' });
    expect(plans.accessFor).not.toHaveBeenCalled();
  });

  it('el ADMIN no tiene restricciones', async () => {
    const { run } = setup(vencida, { [REQUIRES_FEATURE]: 'ai' });
    await expect(run('POST', { userId: 'a', role: 'ADMIN' })).resolves.toMatchObject({ r: 'ok' });
  });

  it('el 402 explica qué pasa', async () => {
    const { run } = setup({ ...vencida, subscriptionExpiresAt: at(-2) });
    const err: HttpException = await run('POST').catch((e) => e);
    expect((err.getResponse() as any).message).toMatch(/Podés consultar tus datos/);
  });
});
