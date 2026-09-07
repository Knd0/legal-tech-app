import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RegisterDto, ResetPasswordDto, VerifyPhoneOtpDto } from './auth.dto';

/**
 * Ejercita el mismo `ValidationPipe` que se registra en `main.ts`, para verificar
 * que la validación realmente corre en runtime. Antes de esta suite los tipos de
 * `@Body()` eran interfaces inline: TypeScript los borra al compilar, así que la
 * API aceptaba cualquier JSON.
 */
describe('ValidationPipe sobre los DTOs de auth', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const run = (metatype: any, value: any) =>
    pipe.transform(value, { type: 'body', metatype });

  const validRegister = {
    email: 'abogada@estudio.com',
    password: 'Contrasena1',
    fullName: 'Abogada Pérez',
  };

  describe('RegisterDto', () => {
    it('acepta un registro válido', async () => {
      await expect(run(RegisterDto, validRegister)).resolves.toMatchObject({
        email: 'abogada@estudio.com',
        fullName: 'Abogada Pérez',
      });
    });

    it('rechaza un email con formato inválido', async () => {
      await expect(run(RegisterDto, { ...validRegister, email: 'no-es-un-email' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza contraseñas de menos de 8 caracteres', async () => {
      await expect(run(RegisterDto, { ...validRegister, password: 'Abc123' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza contraseñas sin mayúscula ni número', async () => {
      await expect(
        run(RegisterDto, { ...validRegister, password: 'contrasenalarga' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza fullName vacío', async () => {
      await expect(run(RegisterDto, { ...validRegister, fullName: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza campos extra: no se puede inyectar role en el registro', async () => {
      await expect(run(RegisterDto, { ...validRegister, role: 'ADMIN' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('acepta phoneNumber opcional y lo deja fuera si no viene', async () => {
      const result: any = await run(RegisterDto, validRegister);
      expect(result.phoneNumber).toBeUndefined();
    });
  });

  describe('ResetPasswordDto', () => {
    const valid = {
      email: 'abogada@estudio.com',
      otp: '123456',
      newPassword: 'NuevaClave1',
    };

    it('acepta un reset válido', async () => {
      await expect(run(ResetPasswordDto, valid)).resolves.toMatchObject({ otp: '123456' });
    });

    it('rechaza un OTP que no tenga 6 dígitos', async () => {
      await expect(run(ResetPasswordDto, { ...valid, otp: '12345' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza un OTP no numérico', async () => {
      await expect(run(ResetPasswordDto, { ...valid, otp: 'abcdef' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('aplica la misma política de contraseña que el registro', async () => {
      await expect(run(ResetPasswordDto, { ...valid, newPassword: 'debil' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('VerifyPhoneOtpDto', () => {
    it('acepta un número con formato internacional', async () => {
      await expect(
        run(VerifyPhoneOtpDto, { phoneNumber: '+54 9 11 2233-4455', otp: '123456' }),
      ).resolves.toBeDefined();
    });

    it('rechaza un número con letras', async () => {
      await expect(
        run(VerifyPhoneOtpDto, { phoneNumber: 'llamame', otp: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
