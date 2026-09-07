import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class BuscarJurisprudenciaDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(300)
  q?: string;

  @IsOptional()
  @IsIn(['SUMARIO', 'FALLO'])
  tipo?: 'SUMARIO' | 'FALLO';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jurisdiccion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class IngestarJurisprudenciaDto {
  @IsOptional()
  @IsIn(['SUMARIO', 'FALLO'])
  tipo?: 'SUMARIO' | 'FALLO';

  /** Tope por corrida. El corpus completo son ~900.000 documentos: la ingesta
   *  se hace en tandas, no de una sola vez. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  maxDocumentos?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desdeOffset?: number;
}
