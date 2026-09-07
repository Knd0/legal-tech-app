import { TipoDocumentoJurisprudencia } from '../jurisprudencia.entity';

/** Documento ya normalizado, independiente de la fuente. */
export interface DocumentoJurisprudencia {
  fuente: string;
  fuenteId: string;
  tipoDocumento: TipoDocumentoJurisprudencia;
  titulo: string;
  sumario: string | null;
  tribunal: string | null;
  jurisdiccion: string | null;
  caratula: string | null;
  fecha: string | null;
  descriptores: string[];
  urlOrigen: string | null;
  raw: Record<string, any> | null;
}

export interface PaginaJurisprudencia {
  documentos: DocumentoJurisprudencia[];
  /** Total informado por la fuente para la consulta (no de la página). */
  total: number;
}

export interface OpcionesFetch {
  offset: number;
  limit: number;
  /** Filtro de tipo. Si se omite, la fuente decide su default. */
  tipo?: TipoDocumentoJurisprudencia;
}

/**
 * Contrato que debe cumplir cada fuente de jurisprudencia.
 *
 * Existe para aislar el resto del sistema de la forma concreta de cada portal:
 * el endpoint de SAIJ que consumimos es el que usa su propio frontend, no una
 * API documentada con garantías de estabilidad. Cuando cambie, el daño queda
 * contenido en el adapter.
 */
export interface JurisprudenciaSource {
  readonly nombre: string;
  fetchPagina(opciones: OpcionesFetch): Promise<PaginaJurisprudencia>;
}
