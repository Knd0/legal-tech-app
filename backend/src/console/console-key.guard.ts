import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

/**
 * Protege la API interna que consume la consola central.
 *
 * - Sin `CONSOLE_API_KEY` configurada, la API no existe (404): así no queda
 *   expuesta por accidente en un deploy sin configurar.
 * - Con la clave, exige el encabezado `x-console-key` idéntico (comparación en
 *   tiempo constante). Cualquier otra cosa también responde 404, para no
 *   revelar que el endpoint existe.
 */
@Injectable()
export class ConsoleKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.CONSOLE_API_KEY;
    if (!expected || expected.length < 32) throw new NotFoundException();

    const req = context.switchToHttp().getRequest();
    const provided = req.headers?.['x-console-key'];
    if (typeof provided !== 'string') throw new NotFoundException();

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new NotFoundException();
    return true;
  }
}
