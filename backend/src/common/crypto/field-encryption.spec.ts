import { decryptValue, encryptValue, encryptedColumn, ENCRYPTED_PREFIX, isEncrypted } from './field-encryption';

describe('field-encryption', () => {
  const ORIGINAL_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY;

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    else process.env.CREDENTIALS_ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  describe('con CREDENTIALS_ENCRYPTION_KEY definida', () => {
    beforeEach(() => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = 'clave-de-prueba-suficientemente-larga';
    });

    it('cifra y descifra una clave privada AFIP sin perder contenido', () => {
      const pem = '-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n';
      const stored = encryptValue(pem) as string;

      expect(stored.startsWith(ENCRYPTED_PREFIX)).toBe(true);
      expect(stored).not.toContain('PRIVATE KEY');
      expect(decryptValue(stored)).toBe(pem);
    });

    it('usa un IV distinto en cada cifrado', () => {
      expect(encryptValue('misma-clave')).not.toBe(encryptValue('misma-clave'));
    });

    it('no vuelve a cifrar un valor ya cifrado', () => {
      const once = encryptValue('secreto') as string;
      expect(encryptValue(once)).toBe(once);
    });

    it('lee valores heredados en texto plano tal cual', () => {
      expect(decryptValue('password-viejo')).toBe('password-viejo');
    });

    it('deja pasar null, undefined y vacío', () => {
      expect(encryptValue(null)).toBeNull();
      expect(encryptValue(undefined)).toBeUndefined();
      expect(encryptValue('')).toBe('');
      expect(decryptValue(null)).toBeNull();
    });

    it('devuelve null si el valor se cifró con otra clave', () => {
      const stored = encryptValue('secreto') as string;
      process.env.CREDENTIALS_ENCRYPTION_KEY = 'otra-clave-distinta';
      expect(decryptValue(stored)).toBeNull();
    });

    it('detecta un valor adulterado (GCM autentica el contenido)', () => {
      const stored = encryptValue('secreto') as string;
      const tampered = stored.slice(0, -4) + (stored.endsWith('AAAA') ? 'BBBB' : 'AAAA');
      expect(decryptValue(tampered)).toBeNull();
    });

    it('el transformer de TypeORM hace el viaje completo', () => {
      const dbValue = encryptedColumn.to('pjn-pass');
      expect(isEncrypted(dbValue)).toBe(true);
      expect(encryptedColumn.from(dbValue)).toBe('pjn-pass');
    });
  });

  describe('sin CREDENTIALS_ENCRYPTION_KEY', () => {
    beforeEach(() => {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    });

    it('no rompe: guarda en texto plano', () => {
      expect(encryptValue('secreto')).toBe('secreto');
    });

    it('no puede leer valores cifrados y devuelve null', () => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = 'clave';
      const stored = encryptValue('secreto') as string;
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
      expect(decryptValue(stored)).toBeNull();
    });
  });
});
