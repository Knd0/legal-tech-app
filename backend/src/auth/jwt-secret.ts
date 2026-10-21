/**
 * Devuelve el secreto con el que se firman y verifican los JWT.
 *
 * Antes había un fallback a `'secretKey'`: si `JWT_SECRET` faltaba en el
 * servidor, cualquiera que leyera el repo (es público) podía firmar tokens de
 * cualquier usuario, incluido el ADMIN. Ahora el arranque falla con un mensaje
 * claro. Sólo los tests usan un secreto fijo.
 */
export function resolveJwtSecret(configured: string | undefined | null): string {
  if (configured && configured.trim().length > 0) return configured;
  if (process.env.NODE_ENV === 'test') return 'test-only-jwt-secret';
  throw new Error(
    'Falta la variable de entorno JWT_SECRET. Generá una con `openssl rand -base64 48` y cargala antes de arrancar.',
  );
}
