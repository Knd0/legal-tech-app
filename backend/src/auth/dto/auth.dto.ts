import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Requisitos de contraseña, alineados con el hint que muestra `register.html`.
 * Se validan también en el servidor porque el cliente puede ser evitado.
 */
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // límite duro de bcrypt: ignora bytes más allá de 72
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PASSWORD_MESSAGE =
  'La contraseña debe incluir al menos una minúscula, una mayúscula y un número.';

/**
 * Normaliza strings antes de validarlos. Sin esto, `@IsNotEmpty` acepta un valor
 * como `'   '` y el nombre se guarda en blanco. Las contraseñas no se recortan:
 * los espacios son caracteres válidos dentro de una contraseña.
 */
const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class RegisterDto {
  @Trim()
  @IsEmail({}, { message: 'El email no tiene un formato válido.' })
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es obligatorio.' })
  @MaxLength(120)
  fullName: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;
}

export class ForgotPasswordDto {
  @Trim()
  @IsEmail({}, { message: 'El email no tiene un formato válido.' })
  @MaxLength(255)
  email: string;
}

export class ResetPasswordDto {
  @Trim()
  @IsEmail({}, { message: 'El email no tiene un formato válido.' })
  @MaxLength(255)
  email: string;

  @IsString()
  @Length(6, 6, { message: 'El código debe tener 6 dígitos.' })
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos.' })
  otp: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(6, 6, { message: 'El código debe tener 6 dígitos.' })
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos.' })
  otp: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class PhoneNumberDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El número de teléfono es obligatorio.' })
  @Matches(/^\+?[\d\s()-]{8,20}$/, {
    message: 'El número de teléfono no tiene un formato válido.',
  })
  phoneNumber: string;
}

export class VerifyPhoneOtpDto extends PhoneNumberDto {
  @IsString()
  @Length(6, 6, { message: 'El código debe tener 6 dígitos.' })
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos.' })
  otp: string;
}
