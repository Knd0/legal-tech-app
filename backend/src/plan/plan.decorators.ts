import { SetMetadata } from '@nestjs/common';
import type { Feature, LimitedResource } from './plan-policy';

export const REQUIRES_FEATURE = 'plan:feature';
export const PLAN_LIMIT = 'plan:limit';
export const ALLOW_WITHOUT_SUBSCRIPTION = 'plan:allow-inactive';

/** La ruta sólo está disponible en planes que incluyen la función. */
export const RequiresFeature = (feature: Feature) => SetMetadata(REQUIRES_FEATURE, feature);

/** Antes de crear, verifica que no se haya alcanzado el límite del plan. */
export const PlanLimit = (resource: LimitedResource) => SetMetadata(PLAN_LIMIT, resource);

/** Escritura permitida aunque la suscripción esté vencida (perfil, pagos, soporte). */
export const AllowWithoutSubscription = () => SetMetadata(ALLOW_WITHOUT_SUBSCRIPTION, true);
