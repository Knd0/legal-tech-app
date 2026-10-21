/**
 * Única fuente de verdad sobre qué puede hacer cada estudio según su plan y el
 * estado de su suscripción. La usan el servidor (PlanAccessInterceptor) y el
 * endpoint GET /plan que consume el frontend: así lo que se muestra y lo que se
 * permite no pueden divergir.
 *
 * Coincide con lo publicado en la landing, la ayuda y los términos.
 */
export type PlanCode = 'basic' | 'pro';
export type Feature = 'ai' | 'afip' | 'whatsapp';
export type LimitedResource = 'clientes' | 'expedientes';

export const TRIAL_DAYS = 14;
export const GRACE_PERIOD_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const PLANS: Record<PlanCode, { name: string; priceArs: number; limits: Record<LimitedResource, number | null>; features: Record<Feature, boolean> }> = {
  basic: {
    name: 'Básico',
    priceArs: 20000,
    limits: { clientes: 10, expedientes: 15 },
    features: { ai: false, afip: false, whatsapp: false },
  },
  pro: {
    name: 'Profesional',
    priceArs: 35000,
    limits: { clientes: null, expedientes: null },
    features: { ai: true, afip: true, whatsapp: true },
  },
};

export type AccessState = 'trial' | 'active' | 'grace' | 'expired' | 'inactive';

export interface PlanAccess {
  plan: PlanCode;
  planName: string;
  /** Plan cuyas reglas se aplican hoy (en la prueba se usa Profesional). */
  effectivePlan: PlanCode;
  state: AccessState;
  canWrite: boolean;
  expiresAt: string | null;
  graceEndsAt: string | null;
  daysLeft: number | null;
  limits: Record<LimitedResource, number | null>;
  features: Record<Feature, boolean>;
}

export interface SubscriptionLike {
  subscriptionStatus?: string | null;
  subscriptionPlan?: string | null;
  subscriptionExpiresAt?: Date | string | null;
}

export function computeAccess(sub: SubscriptionLike | null | undefined, isAdmin = false, now = new Date()): PlanAccess {
  const plan: PlanCode = sub?.subscriptionPlan === 'basic' ? 'basic' : 'pro';
  const status = sub?.subscriptionStatus ?? 'trial';
  const expires = sub?.subscriptionExpiresAt ? new Date(sub.subscriptionExpiresAt) : null;

  if (isAdmin) {
    return build('pro', 'pro', 'active', true, null, null, now);
  }

  // La prueba tiene todo lo del plan Profesional.
  const effectivePlan: PlanCode = status === 'trial' ? 'pro' : plan;

  if (status !== 'trial' && status !== 'active') {
    // Pausada o cancelada en Mercado Pago: puede ver sus datos pero no cargar nuevos.
    return build(plan, effectivePlan, 'inactive', false, expires, null, now);
  }
  if (!expires || now.getTime() <= expires.getTime()) {
    return build(plan, effectivePlan, status === 'trial' ? 'trial' : 'active', true, expires, null, now);
  }
  const graceEnds = new Date(expires.getTime() + GRACE_PERIOD_DAYS * DAY_MS);
  const state: AccessState = now.getTime() <= graceEnds.getTime() ? 'grace' : 'expired';
  return build(plan, effectivePlan, state, false, expires, graceEnds, now);
}

function build(plan: PlanCode, effectivePlan: PlanCode, state: AccessState, canWrite: boolean, expires: Date | null, graceEnds: Date | null, now: Date): PlanAccess {
  const rules = PLANS[effectivePlan];
  return {
    plan,
    planName: PLANS[plan].name,
    effectivePlan,
    state,
    canWrite,
    expiresAt: expires ? expires.toISOString() : null,
    graceEndsAt: graceEnds ? graceEnds.toISOString() : null,
    daysLeft: expires ? Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / DAY_MS)) : null,
    limits: rules.limits,
    features: rules.features,
  };
}

export function trialExpiry(from = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * DAY_MS);
}
