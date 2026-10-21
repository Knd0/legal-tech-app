import { CallHandler, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ALLOW_WITHOUT_SUBSCRIPTION, PLAN_LIMIT, REQUIRES_FEATURE } from './plan.decorators';
import { Feature, LimitedResource, PLANS } from './plan-policy';
import { PlanService } from './plan.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const FEATURE_NAMES: Record<Feature, string> = {
  ai: 'El Copiloto de IA',
  afip: 'La facturación electrónica AFIP/ARCA',
  whatsapp: 'Las alertas por WhatsApp',
};

/**
 * Aplica en el servidor las reglas del plan. Antes sólo las aplicaba el
 * frontend (deshabilitando botones), así que cualquiera podía saltearlas
 * llamando a la API, y el límite de clientes contaba sólo la página cargada.
 *
 * Corre después de los guards, cuando req.user ya está resuelto.
 */
@Injectable()
export class PlanAccessInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly plans: PlanService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.userId) return next.handle(); // rutas públicas o sin sesión

    const targets = [context.getHandler(), context.getClass()];
    const feature = this.reflector.getAllAndOverride<Feature>(REQUIRES_FEATURE, targets);
    const limit = this.reflector.getAllAndOverride<LimitedResource>(PLAN_LIMIT, targets);
    const allowInactive = this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_SUBSCRIPTION, targets);
    const isWrite = !SAFE_METHODS.has(req.method);

    if (!feature && !limit && (!isWrite || allowInactive)) return next.handle();

    const access = await this.plans.accessFor(user.userId, user.role === 'ADMIN');

    if (isWrite && !allowInactive && !access.canWrite) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          code: 'SUBSCRIPTION_REQUIRED',
          message:
            access.state === 'grace'
              ? 'Tu suscripción venció. Podés consultar tus datos, pero para cargar o modificar necesitás renovarla.'
              : 'Tu suscripción no está activa. Renovala para seguir trabajando.',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    if (feature && !access.features[feature]) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PLAN_FEATURE',
        feature,
        message: `${FEATURE_NAMES[feature]} está incluido en el Plan ${PLANS.pro.name}.`,
      });
    }

    if (limit && isWrite) {
      const max = access.limits[limit];
      if (max !== null && (await this.plans.count(user.userId, limit)) >= max) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'PLAN_LIMIT',
          resource: limit,
          limit: max,
          message: `Llegaste al límite de ${max} ${limit} del Plan ${access.planName}. Pasate al Plan ${PLANS.pro.name} para cargar más.`,
        });
      }
    }

    return next.handle();
  }
}
