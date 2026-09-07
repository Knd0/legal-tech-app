import * as fs from 'fs';
import * as path from 'path';
import { SaijAdapter } from './saij.adapter';

/**
 * Los fixtures son respuestas **reales** de SAIJ capturadas el 2026-09-07
 * (`GET /busqueda?o=0&p=N&f=...`). Ejercitar el normalizador contra la forma
 * verdadera del payload —y no contra un mock idealizado— es lo único que
 * detecta cuando la fuente cambia de estructura.
 */
const cargarFixture = (nombre: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', '__fixtures__', nombre), 'utf-8'));

describe('SaijAdapter.normalizarPagina', () => {
  let adapter: SaijAdapter;

  beforeEach(() => {
    adapter = new SaijAdapter();
  });

  describe('sumarios', () => {
    const payload = () => cargarFixture('saij-sumarios.json');

    it('normaliza todos los documentos de la página', () => {
      const { documentos } = adapter.normalizarPagina(payload(), 'SUMARIO');
      expect(documentos.length).toBeGreaterThan(0);
    });

    it('informa el total del corpus reportado por la fuente', () => {
      const { total } = adapter.normalizarPagina(payload(), 'SUMARIO');
      expect(total).toBeGreaterThan(900_000);
    });

    it('mapea los campos que hacen única y citable a la sentencia', () => {
      const [doc] = adapter.normalizarPagina(payload(), 'SUMARIO').documentos;

      expect(doc.fuente).toBe('SAIJ');
      expect(doc.fuenteId).toBeTruthy();
      expect(doc.tipoDocumento).toBe('SUMARIO');
      expect(doc.titulo).toBeTruthy();
      expect(doc.titulo).not.toBe('Sin título');
    });

    it('conserva el texto de la doctrina', () => {
      const [doc] = adapter.normalizarPagina(payload(), 'SUMARIO').documentos;
      expect(doc.sumario).toBeTruthy();
      expect(doc.sumario!.length).toBeGreaterThan(50);
    });

    it('extrae los descriptores del Tesauro sin repetirlos', () => {
      const [doc] = adapter.normalizarPagina(payload(), 'SUMARIO').documentos;

      expect(doc.descriptores.length).toBeGreaterThan(0);
      expect(new Set(doc.descriptores).size).toBe(doc.descriptores.length);
    });

    it('colapsa la lista de fechas del sumario en la más reciente', () => {
      // Los sumarios agregan muchas sentencias: `fecha` viene como
      // "1987-05-22|1988-10-25|...". Debe quedar una sola fecha ISO válida.
      const [doc] = adapter.normalizarPagina(payload(), 'SUMARIO').documentos;

      expect(doc.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const todas: string[] = (doc.raw as any).content.fecha.split('|');
      const maxima = todas.filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)).sort().pop();
      expect(doc.fecha).toBe(maxima);
    });

    it('no propaga los valores repetidos de tipo-tribunal', () => {
      // SAIJ repite "CS CS CS CS ..." una vez por sentencia agregada.
      const [doc] = adapter.normalizarPagina(payload(), 'SUMARIO').documentos;
      expect(doc.tribunal ?? '').not.toMatch(/(\bCS\b\s+){3,}/);
    });

    it('construye una URL de origen para cumplir la atribución CC-BY', () => {
      const [doc] = adapter.normalizarPagina(payload(), 'SUMARIO').documentos;
      expect(doc.urlOrigen).toContain('saij.gob.ar');
    });

    it('guarda el documento crudo para poder re-derivar campos', () => {
      const [doc] = adapter.normalizarPagina(payload(), 'SUMARIO').documentos;
      expect(doc.raw).toHaveProperty('content');
      expect(doc.raw).toHaveProperty('metadata');
    });
  });

  describe('fallos', () => {
    const payload = () => cargarFixture('saij-fallos.json');

    it('reconstruye la carátula desde actor / demandado / sobre', () => {
      const { documentos } = adapter.normalizarPagina(payload(), 'FALLO');
      const conDemandado = documentos.find((d) => (d.raw as any).content.demandado);

      expect(conDemandado).toBeDefined();
      expect(conDemandado!.caratula).toContain(' c/ ');
      expect(conDemandado!.caratula).toContain(' s/ ');
    });

    it('usa la carátula como título cuando el fallo no trae uno', () => {
      const [doc] = adapter.normalizarPagina(payload(), 'FALLO').documentos;
      expect(doc.titulo).toBe(doc.caratula ?? doc.tribunal);
    });

    it('toma el tribunal y una fecha simple', () => {
      const [doc] = adapter.normalizarPagina(payload(), 'FALLO').documentos;

      expect(doc.tribunal).toContain('CAMARA');
      expect(doc.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('deja el sumario vacío: el listado de fallos no trae el texto completo', () => {
      const [doc] = adapter.normalizarPagina(payload(), 'FALLO').documentos;
      expect(doc.sumario).toBeNull();
    });
  });

  describe('robustez ante payloads inesperados', () => {
    it('devuelve vacío en vez de romper si no hay resultados', () => {
      expect(adapter.normalizarPagina({}, 'SUMARIO')).toEqual({ documentos: [], total: 0 });
    });

    it('descarta el documento corrupto y conserva los sanos', () => {
      const payload = cargarFixture('saij-sumarios.json');
      payload.searchResults.documentResultList[0].documentAbstract = '{ json roto';

      const { documentos } = adapter.normalizarPagina(payload, 'SUMARIO');

      expect(documentos.length).toBe(
        payload.searchResults.documentResultList.length - 1,
      );
    });

    it('ignora entradas sin documentAbstract', () => {
      const payload = { searchResults: { documentResultList: [{ uuid: 'x' }] } };
      expect(adapter.normalizarPagina(payload, 'SUMARIO').documentos).toEqual([]);
    });
  });
});
