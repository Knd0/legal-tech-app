/**
 * Campos de la entidad `User` que NUNCA deben salir del servidor.
 *
 * Además del hash de contraseña, incluye credenciales operativas: la clave
 * privada del certificado AFIP y las contraseñas de los portales judiciales
 * (PJN / MEV). El frontend guarda la respuesta del login en localStorage, así
 * que cualquier campo devuelto acá queda expuesto a XSS y a inspección manual.
 */
export const SENSITIVE_USER_FIELDS = [
  'passwordHash',
  'afipKey',
  'pjnPassword',
  'mevPassword',
] as const;

/**
 * Campos que el propio usuario puede modificar vía `PATCH /users/profile`.
 *
 * Es una lista blanca deliberada: `role`, `isActive`, `email`, `passwordHash` e
 * `isPhoneVerified` los controla el servidor y no pueden llegar desde el body,
 * porque `usersRepository.update()` escribe cualquier columna que reciba.
 */
export const SELF_EDITABLE_USER_FIELDS = [
  'fullName',
  'phoneNumber',
  'address',
  'cuit',
  'iibb',
  'initActivityUser',
  'puntoVenta',
  'condicionIva',
  'afipCert',
  'afipKey',
  'afipProduction',
  'daysBeforeAlert',
  'daysBeforeAlertSecondary',
  'alertWhatsapp',
  'alertPush',
  'alertOnDueDate',
  'alertTypeAudiencias',
  'alertTypeVencimientos',
  'alertTypeEscritos',
  'pjnUser',
  'pjnPassword',
  'mevUser',
  'mevPassword',
] as const;

/** Quita los campos sensibles de un usuario antes de serializarlo. */
export function sanitizeUser(user: any): any {
  if (!user) return null;
  const clean = { ...user };
  for (const field of SENSITIVE_USER_FIELDS) {
    delete clean[field];
  }
  // Señal booleana para que la UI sepa si hay credenciales cargadas sin
  // recibir su contenido.
  clean.hasAfipKey = Boolean(user.afipKey);
  clean.hasPjnCredentials = Boolean(user.pjnUser && user.pjnPassword);
  clean.hasMevCredentials = Boolean(user.mevUser && user.mevPassword);
  return clean;
}

/**
 * Aplana la suscripción sobre el usuario (el frontend la consume plana) y quita
 * los campos sensibles.
 */
export function sanitizeAndFlattenUser(user: any): any {
  if (!user) return null;
  const { subscription, ...rest } = sanitizeUser(user);
  return {
    ...rest,
    subscriptionStatus: subscription?.subscriptionStatus || 'trial',
    subscriptionExpiresAt: subscription?.subscriptionExpiresAt || null,
    mpSubscriptionId: subscription?.mpSubscriptionId || null,
    subscriptionPlan: subscription?.subscriptionPlan || 'pro',
  };
}

/** Filtra un body arbitrario a los campos que el usuario puede editar de sí mismo. */
export function pickSelfEditableFields(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  if (!data || typeof data !== 'object') return result;
  for (const field of SELF_EDITABLE_USER_FIELDS) {
    if (data[field] !== undefined) {
      result[field] = data[field];
    }
  }
  return result;
}
