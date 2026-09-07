import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Jurisprudencia, TipoDocumentoJurisprudencia } from './jurisprudencia.entity';
import { SaijAdapter } from './adapters/saij.adapter';
import { DocumentoJurisprudencia } from './adapters/jurisprudencia-source';
import { construirTextoBusqueda, quitarAcentos } from './texto-busqueda.util';

export interface ResultadoIngesta {
  leidos: number;
  nuevos: number;
  actualizados: number;
  totalEnFuente: number;
}

export interface ResultadoBusqueda {
  data: Jurisprudencia[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class JurisprudenciaService implements OnModuleInit {
  private readonly logger = new Logger(JurisprudenciaService.name);

  /** Tope de páginas por corrida, para no dejar un job colgado horas. */
  private readonly MAX_PAGINAS = 40;
  private readonly TAMANO_PAGINA = 25;
  /** Pausa entre requests: el corpus es público pero no hay que castigar SAIJ. */
  private readonly PAUSA_MS = 500;

  constructor(
    @InjectRepository(Jurisprudencia)
    private readonly repo: Repository<Jurisprudencia>,
    private readonly dataSource: DataSource,
    private readonly saij: SaijAdapter,
  ) {}

  /**
   * `synchronize: true` crea la tabla y la columna generada, pero no el índice
   * GIN que hace usable la búsqueda full-text. Se crea acá de forma idempotente.
   */
  async onModuleInit() {
    try {
      await this.dataSource.query(
        'CREATE INDEX IF NOT EXISTS idx_jurisprudencia_busqueda ON jurisprudencia USING GIN (busqueda)',
      );
    } catch (error: any) {
      // No es fatal: la búsqueda funciona sin índice, sólo más lenta.
      this.logger.warn(`No se pudo crear el índice de búsqueda: ${error.message}`);
    }
  }

  /**
   * Búsqueda full-text en español sobre el corpus.
   *
   * Usa `plainto_tsquery`, que trata la consulta como texto natural y no falla
   * ante comillas o paréntesis que el abogado escriba sin intención de sintaxis.
   */
  async buscar(params: {
    q?: string;
    tipo?: TipoDocumentoJurisprudencia;
    jurisdiccion?: string;
    page?: number;
    limit?: number;
  }): Promise<ResultadoBusqueda> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));

    const qb = this.repo.createQueryBuilder('j');

    if (params.q?.trim()) {
      // La consulta se normaliza igual que el texto indexado, para que buscar
      // sin tildes encuentre los documentos que sí las tienen.
      const q = quitarAcentos(params.q.trim());
      qb.andWhere("j.busqueda @@ plainto_tsquery('spanish', :q)", { q })
        .addSelect("ts_rank(j.busqueda, plainto_tsquery('spanish', :q))", 'rank')
        .orderBy('rank', 'DESC')
        .addOrderBy('j.fecha', 'DESC', 'NULLS LAST');
    } else {
      qb.orderBy('j.fecha', 'DESC', 'NULLS LAST');
    }

    if (params.tipo) {
      qb.andWhere('j.tipoDocumento = :tipo', { tipo: params.tipo });
    }
    if (params.jurisdiccion) {
      qb.andWhere('j.jurisdiccion ILIKE :jur', { jur: `%${params.jurisdiccion}%` });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findOne(id: string): Promise<Jurisprudencia | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Ingesta incremental desde SAIJ.
   *
   * Es idempotente: la clave natural `(fuente, fuenteId)` permite re-correrla
   * sin duplicar. Se procesa página por página en vez de acumular todo en
   * memoria, porque el corpus completo son ~900.000 documentos.
   */
  async ingestarDesdeSaij(opciones: {
    tipo?: TipoDocumentoJurisprudencia;
    maxDocumentos?: number;
    desdeOffset?: number;
  } = {}): Promise<ResultadoIngesta> {
    const tipo = opciones.tipo ?? 'SUMARIO';
    const maxDocumentos = opciones.maxDocumentos ?? 200;
    let offset = opciones.desdeOffset ?? 0;

    const resultado: ResultadoIngesta = {
      leidos: 0,
      nuevos: 0,
      actualizados: 0,
      totalEnFuente: 0,
    };

    for (let pagina = 0; pagina < this.MAX_PAGINAS; pagina++) {
      if (resultado.leidos >= maxDocumentos) break;

      const restantes = maxDocumentos - resultado.leidos;
      const limit = Math.min(this.TAMANO_PAGINA, restantes);

      const { documentos, total } = await this.saij.fetchPagina({ offset, limit, tipo });
      resultado.totalEnFuente = total;

      if (!documentos.length) break;

      for (const documento of documentos) {
        const guardado = await this.guardarDocumento(documento);
        resultado.leidos++;
        if (guardado === 'nuevo') resultado.nuevos++;
        else resultado.actualizados++;
      }

      offset += limit;
      if (offset >= total) break;

      await this.esperar(this.PAUSA_MS);
    }

    this.logger.log(
      `Ingesta SAIJ (${tipo}) finalizada: ${resultado.leidos} leídos, ` +
        `${resultado.nuevos} nuevos, ${resultado.actualizados} actualizados.`,
    );
    return resultado;
  }

  /** Upsert por clave natural. Devuelve si el documento ya existía. */
  private async guardarDocumento(
    documento: DocumentoJurisprudencia,
  ): Promise<'nuevo' | 'actualizado'> {
    const existente = await this.repo.findOne({
      where: { fuente: documento.fuente, fuenteId: documento.fuenteId },
      select: { id: true },
    });

    const fila = { ...documento, textoBusqueda: construirTextoBusqueda(documento) };

    if (existente) {
      await this.repo.update(existente.id, fila);
      return 'actualizado';
    }

    await this.repo.save(this.repo.create(fila));
    return 'nuevo';
  }

  private esperar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
