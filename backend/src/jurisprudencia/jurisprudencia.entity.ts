import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type TipoDocumentoJurisprudencia = 'SUMARIO' | 'FALLO';

/**
 * Corpus de jurisprudencia argentina.
 *
 * ⚠️ **Es la primera entidad NO multi-inquilino del sistema**: a diferencia de
 * clients / expedientes / facturas, esta tabla es un corpus público compartido
 * por todos los estudios y **no lleva `userId`**. La regla de "filtrar siempre
 * por el userId del token" no aplica acá — pero tampoco debe relajarse en el
 * resto: si en el futuro se agregan notas o favoritos por abogado, esos van en
 * una tabla aparte que sí lleva `userId`.
 *
 * Fuente inicial: SAIJ (Ministerio de Justicia), CC-BY 4.0 → la atribución es
 * obligatoria y se preserva en `fuente` + `urlOrigen`.
 */
@Entity()
@Unique('uq_jurisprudencia_fuente_doc', ['fuente', 'fuenteId'])
export class Jurisprudencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Sistema de origen. Hoy sólo 'SAIJ'; el adapter define el valor. */
  @Column({ length: 20 })
  fuente: string;

  /** Identificador del documento en la fuente (uuid de SAIJ). Junto a `fuente`
   *  forma la clave natural que hace idempotente la ingesta. */
  @Column()
  fuenteId: string;

  @Index()
  @Column({ type: 'varchar', length: 10 })
  tipoDocumento: TipoDocumentoJurisprudencia;

  @Column({ type: 'text' })
  titulo: string;

  /** Texto de la doctrina (sumario). Los fallos no lo traen en el listado de
   *  búsqueda: queda vacío hasta que se haga la carga del texto completo. */
  @Column({ type: 'text', nullable: true })
  sumario: string | null;

  @Column({ type: 'text', nullable: true })
  tribunal: string | null;

  @Index()
  @Column({ type: 'varchar', length: 120, nullable: true })
  jurisdiccion: string | null;

  /** Carátula reconstruida (`actor c/ demandado s/ sobre`) para los fallos. */
  @Column({ type: 'text', nullable: true })
  caratula: string | null;

  /**
   * Fecha del fallo. Los sumarios de SAIJ agregan muchas sentencias y traen una
   * lista de fechas separadas por `|`; en ese caso se guarda la más reciente y
   * la lista completa queda en `raw`.
   */
  @Index()
  @Column({ type: 'date', nullable: true })
  fecha: string | null;

  /** Descriptores del Tesauro SAIJ (vocabulario controlado). */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  descriptores: string[];

  /** URL canónica en la fuente, requerida por la atribución CC-BY. */
  @Column({ type: 'text', nullable: true })
  urlOrigen: string | null;

  /** Respuesta original sin normalizar. Permite re-derivar campos si el mapeo
   *  cambia, sin volver a bajar todo el corpus. */
  @Column({ type: 'jsonb', nullable: true })
  raw: Record<string, any> | null;

  /**
   * Texto plano y **sin acentos** que alimenta el índice de búsqueda.
   *
   * Lo escribe la aplicación vía `construirTextoBusqueda()`. Existe para que
   * buscar "danos y perjuicios" encuentre "daños y perjuicios": ver la nota en
   * `texto-busqueda.util.ts`.
   */
  @Column({ type: 'text', nullable: true, select: false })
  textoBusqueda: string | null;

  /**
   * Índice de texto completo en español, mantenido por Postgres.
   *
   * Es una columna generada sobre `textoBusqueda`: no se escribe desde la
   * aplicación. El índice GIN que la acompaña se crea en
   * `JurisprudenciaService.onModuleInit()`, porque `synchronize: true` crea
   * columnas pero no índices de este tipo.
   */
  @Column({
    type: 'tsvector',
    select: false,
    nullable: true,
    asExpression: "to_tsvector('spanish', coalesce(\"textoBusqueda\",''))",
    generatedType: 'STORED',
  })
  busqueda: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
