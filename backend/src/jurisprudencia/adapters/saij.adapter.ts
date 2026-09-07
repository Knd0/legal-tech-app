import { Injectable, Logger } from '@nestjs/common';
import {
  DocumentoJurisprudencia,
  JurisprudenciaSource,
  OpcionesFetch,
  PaginaJurisprudencia,
} from './jurisprudencia-source';
import { TipoDocumentoJurisprudencia } from '../jurisprudencia.entity';

const BASE_URL = 'https://www.saij.gob.ar';

/**
 * Adapter del Sistema Argentino de Información Jurídica (SAIJ).
 *
 * SAIJ publica ~904.000 documentos de jurisprudencia y su buscador devuelve
 * **JSON estructurado** (no hay que parsear HTML): `GET /busqueda?o=<offset>&
 * p=<pageSize>&f=<facetas>&t=<total>`. Cada resultado trae `documentAbstract`,
 * que a su vez es un JSON serializado como string y hay que parsear aparte.
 *
 * ⚠️ No es una API con contrato público: es el endpoint que consume su propio
 * frontend y puede cambiar sin aviso. Por eso toda la fragilidad vive acá y el
 * resto del sistema sólo ve `DocumentoJurisprudencia`.
 *
 * Licencia de los datos: CC-BY 4.0 → la atribución a SAIJ es obligatoria y se
 * conserva en `fuente` y `urlOrigen`.
 */
@Injectable()
export class SaijAdapter implements JurisprudenciaSource {
  readonly nombre = 'SAIJ';
  private readonly logger = new Logger(SaijAdapter.name);

  private readonly facetas: Record<TipoDocumentoJurisprudencia, string> = {
    SUMARIO: 'Total|Tipo de Documento/Jurisprudencia/Sumario',
    FALLO: 'Total|Tipo de Documento/Jurisprudencia/Fallo',
  };

  async fetchPagina(opciones: OpcionesFetch): Promise<PaginaJurisprudencia> {
    const { offset, limit, tipo = 'SUMARIO' } = opciones;

    const params = new URLSearchParams({
      o: String(offset),
      p: String(limit),
      f: this.facetas[tipo],
      t: String(limit),
    });
    const url = `${BASE_URL}/busqueda?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        // SAIJ rechaza requests sin User-Agent. Se identifica el cliente en
        // lugar de suplantar un navegador.
        'User-Agent': 'Themis/1.0 (+https://themis.up.railway.app)',
        Accept: 'application/json,text/plain,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`SAIJ respondió ${response.status} para ${url}`);
    }

    const payload = await response.json();
    return this.normalizarPagina(payload, tipo);
  }

  /**
   * Convierte la respuesta cruda de SAIJ al formato interno.
   *
   * Público para poder ejercitarlo en tests con respuestas reales capturadas,
   * sin salir a la red.
   */
  normalizarPagina(payload: any, tipo: TipoDocumentoJurisprudencia): PaginaJurisprudencia {
    const resultados = payload?.searchResults?.documentResultList ?? [];
    const documentos: DocumentoJurisprudencia[] = [];

    for (const resultado of resultados) {
      try {
        const documento = this.normalizarDocumento(resultado, tipo);
        if (documento) documentos.push(documento);
      } catch (error: any) {
        // Un documento con forma inesperada no debe abortar la página entera:
        // sobre cientos de miles de registros, siempre hay excepciones.
        this.logger.warn(
          `Documento SAIJ ${resultado?.uuid ?? '(sin uuid)'} descartado: ${error.message}`,
        );
      }
    }

    return {
      documentos,
      total: this.extraerTotal(payload),
    };
  }

  private normalizarDocumento(
    resultado: any,
    tipo: TipoDocumentoJurisprudencia,
  ): DocumentoJurisprudencia | null {
    if (!resultado?.documentAbstract) return null;

    const documento = JSON.parse(resultado.documentAbstract)?.document;
    const metadata = documento?.metadata ?? {};
    const content = documento?.content ?? {};
    const uuid = metadata.uuid ?? resultado.uuid;
    if (!uuid) return null;

    const caratula = this.construirCaratula(content);
    const titulo =
      this.texto(content.titulo) ?? caratula ?? this.texto(content.tribunal) ?? 'Sin título';

    return {
      fuente: this.nombre,
      fuenteId: uuid,
      tipoDocumento: tipo,
      titulo,
      sumario: this.texto(content.texto),
      tribunal: this.normalizarTribunal(content.tribunal ?? content['tipo-tribunal']),
      jurisdiccion: this.texto(content.jurisdiccion?.descripcion),
      caratula,
      fecha: this.fechaMasReciente(content.fecha),
      descriptores: this.extraerDescriptores(content),
      urlOrigen: this.construirUrl(metadata),
      raw: documento,
    };
  }

  /** `actor c/ demandado s/ sobre` — el formato usual de una carátula. */
  private construirCaratula(content: any): string | null {
    const actor = this.texto(content.actor);
    const demandado = this.texto(content.demandado);
    const sobre = this.texto(content.sobre);
    if (!actor && !demandado && !sobre) return null;

    let caratula = actor ?? '';
    if (demandado) caratula += `${caratula ? ' c/ ' : ''}${demandado}`;
    if (sobre) caratula += `${caratula ? ' s/ ' : ''}${sobre}`;
    return caratula || null;
  }

  /**
   * Los sumarios agregan varias sentencias y traen las fechas separadas por `|`
   * (`"1987-05-22|1988-10-25|..."`). Se guarda la más reciente como fecha
   * representativa; la lista completa queda en `raw`.
   */
  private fechaMasReciente(valor: any): string | null {
    const texto = this.texto(valor);
    if (!texto) return null;

    const fechas = texto
      .split('|')
      .map((f) => f.trim())
      .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
      .sort();

    return fechas.length ? fechas[fechas.length - 1] : null;
  }

  /**
   * Descriptores del Tesauro SAIJ. Se toma el término `elegido` (el preferido
   * trae la rama completa, p. ej. "Derecho procesal/recursos/recurso de
   * casación", demasiado específica para filtrar).
   */
  private extraerDescriptores(content: any): string[] {
    const bruto = content?.descriptores?.descriptor;
    if (!bruto) return [];

    const lista = Array.isArray(bruto) ? bruto : [bruto];
    const terminos = lista
      .map((d: any) => this.texto(d?.elegido?.termino))
      .filter((t): t is string => Boolean(t));

    return [...new Set(terminos)];
  }

  private construirUrl(metadata: any): string | null {
    const subdomain = metadata?.['friendly-url']?.subdomain;
    const description = metadata?.['friendly-url']?.description;
    if (subdomain && description) {
      return `${BASE_URL}/${description}?${subdomain}`;
    }
    return metadata?.uuid ? `${BASE_URL}/busqueda?q=${metadata.uuid}` : null;
  }

  private extraerTotal(payload: any): number {
    const categorias = payload?.searchResults?.categoriesResultList ?? [];
    const total = categorias.find((c: any) => c?.facetName === 'Total');
    return total?.facetChildren?.[0]?.facetHits ?? 0;
  }

  /**
   * Normaliza el tribunal.
   *
   * En los sumarios, `tipo-tribunal` trae el código repetido una vez por
   * sentencia agregada (`"CS CS CS CS ..."`, hasta cientos de veces). En los
   * fallos, `tribunal` es un nombre propio ("CAMARA NACIONAL DE APELACIONES DEL
   * TRABAJO") que no se debe tocar.
   *
   * La distinción es que la lista de códigos está formada **sólo** por tokens
   * cortos; cualquier nombre real contiene al menos una palabra larga. Por eso
   * únicamente se deduplica cuando todos los tokens son códigos.
   */
  private normalizarTribunal(valor: any): string | null {
    const texto = this.texto(valor);
    if (!texto) return null;

    const tokens = texto.split(/\s+/).filter(Boolean);
    const esListaDeCodigos = tokens.length > 1 && tokens.every((t) => t.length <= 5);
    if (!esListaDeCodigos) return texto;

    return [...new Set(tokens)].join(' ');
  }

  private texto(valor: any): string | null {
    if (typeof valor !== 'string') return null;
    const limpio = valor.replace(/\s+/g, ' ').trim();
    return limpio.length ? limpio : null;
  }
}
