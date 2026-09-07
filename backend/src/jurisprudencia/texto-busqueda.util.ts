/**
 * Normalización de texto para la búsqueda full-text.
 *
 * Los abogados escriben las consultas sin tildes ("danos y perjuicios",
 * "prescripcion") con muchísima frecuencia, pero `to_tsvector('spanish', ...)`
 * es sensible a los acentos: indexa "daños" como `dañ` y "danos" como `dan`, que
 * nunca coinciden.
 *
 * En vez de depender de la extensión `unaccent` de Postgres (que no está en
 * todos los planes gestionados y exige un wrapper IMMUTABLE para poder usarse en
 * una columna generada), se normaliza en la aplicación: se guarda una copia sin
 * acentos del texto indexable y se aplica la **misma** transformación a la
 * consulta. Mientras ambos lados usen esta función, la coincidencia es exacta.
 */
export function quitarAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Construye el texto plano que alimenta el índice de búsqueda de un documento. */
export function construirTextoBusqueda(campos: {
  titulo?: string | null;
  sumario?: string | null;
  caratula?: string | null;
  tribunal?: string | null;
  descriptores?: string[] | null;
}): string {
  const partes = [
    campos.titulo,
    campos.sumario,
    campos.caratula,
    campos.tribunal,
    ...(campos.descriptores ?? []),
  ].filter((p): p is string => Boolean(p && p.trim()));

  return quitarAcentos(partes.join(' ')).replace(/\s+/g, ' ').trim();
}
