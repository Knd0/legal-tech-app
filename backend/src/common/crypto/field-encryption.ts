import { Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { ValueTransformer } from 'typeorm';

/**
 * Cifrado en reposo de credenciales de terceros (clave privada AFIP, contraseñas
 * de PJN / MEV).
 *
 * Esquema: AES-256-GCM con IV aleatorio por valor. El texto guardado en la base
 * tiene la forma `enc:v1:<iv>:<tag>:<cifrado>` (base64). El prefijo permite
 * convivir con valores viejos en texto plano: se leen tal cual y se re-cifran en
 * el arranque (`UsersService.encryptLegacyCredentials`).
 *
 * La clave sale de `CREDENTIALS_ENCRYPTION_KEY` (generarla con
 * `openssl rand -base64 32`). Sin esa variable el transformer no cifra y se
 * registra un error en el log: así el deploy no se cae, pero queda a la vista.
 * Si la clave cambia, los valores cifrados con la anterior no se pueden leer
 * (se devuelven como `null` y el usuario tiene que volver a cargarlos).
 */
export const ENCRYPTED_PREFIX = 'enc:v1:';

const logger = new Logger('FieldEncryption');
let warnedMissingKey = false;

function getKey(): Buffer | null {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret) {
    if (!warnedMissingKey && process.env.NODE_ENV !== 'test') {
      logger.error(
        'CREDENTIALS_ENCRYPTION_KEY no está definida: las credenciales AFIP/PJN/MEV se guardan SIN cifrar. ' +
          'Generá una con `openssl rand -base64 32` y cargala en las variables de entorno.',
      );
      warnedMissingKey = true;
    }
    return null;
  }
  // SHA-256 normaliza cualquier largo de secreto a los 32 bytes que pide AES-256.
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

export function encryptValue(plain: string | null | undefined): string | null | undefined {
  if (plain === null || plain === undefined || plain === '') return plain;
  if (isEncrypted(plain)) return plain;
  const key = getKey();
  if (!key) return plain;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptValue(stored: string | null | undefined): string | null | undefined {
  if (stored === null || stored === undefined || stored === '') return stored;
  // Valor heredado en texto plano: se devuelve tal cual hasta que se re-cifre.
  if (!isEncrypted(stored)) return stored;

  const key = getKey();
  if (!key) {
    logger.error('Hay credenciales cifradas en la base pero falta CREDENTIALS_ENCRYPTION_KEY para leerlas.');
    return null;
  }

  try {
    const [ivB64, tagB64, dataB64] = stored.slice(ENCRYPTED_PREFIX.length).split(':');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    logger.error('No se pudo descifrar una credencial: la CREDENTIALS_ENCRYPTION_KEY no coincide con la usada al guardarla.');
    return null;
  }
}

/** Transformer de TypeORM: cifra al escribir y descifra al leer. */
export const encryptedColumn: ValueTransformer = {
  to: (value: string | null | undefined) => encryptValue(value),
  from: (value: string | null | undefined) => decryptValue(value),
};
