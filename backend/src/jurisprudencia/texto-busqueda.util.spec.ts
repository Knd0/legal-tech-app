import { construirTextoBusqueda, quitarAcentos } from './texto-busqueda.util';

describe('quitarAcentos', () => {
  it('normaliza las vocales acentuadas del español', () => {
    expect(quitarAcentos('prescripción liberatoria')).toBe('prescripcion liberatoria');
    expect(quitarAcentos('daños y perjuicios')).toBe('danos y perjuicios');
    expect(quitarAcentos('CÁMARA DE APELACIONES')).toBe('CAMARA DE APELACIONES');
  });

  it('deja intacto el texto que ya viene sin acentos', () => {
    expect(quitarAcentos('recurso de casacion')).toBe('recurso de casacion');
  });

  it('es idempotente', () => {
    const una = quitarAcentos('daños');
    expect(quitarAcentos(una)).toBe(una);
  });

  it('no altera la longitud en caracteres base ni pierde la ñ como letra', () => {
    // La ñ se convierte en n: es lo que permite que "danos" matchee "daños".
    expect(quitarAcentos('niño')).toBe('nino');
  });
});

describe('construirTextoBusqueda', () => {
  it('concatena los campos relevantes sin acentos', () => {
    const texto = construirTextoBusqueda({
      titulo: 'Daños y perjuicios',
      sumario: 'Indemnización por reparación',
      caratula: 'Pérez c/ Gómez',
      tribunal: 'CÁMARA NACIONAL',
      descriptores: ['responsabilidad civil'],
    });

    expect(texto).toBe(
      'Danos y perjuicios Indemnizacion por reparacion Perez c/ Gomez CAMARA NACIONAL responsabilidad civil',
    );
  });

  it('omite los campos vacíos sin dejar espacios de más', () => {
    const texto = construirTextoBusqueda({
      titulo: 'Título',
      sumario: null,
      caratula: '   ',
      tribunal: undefined as any,
    });

    expect(texto).toBe('Titulo');
  });

  it('tolera un documento sin ningún campo', () => {
    expect(construirTextoBusqueda({})).toBe('');
  });

  it('incluye los descriptores del Tesauro para que sean buscables', () => {
    const texto = construirTextoBusqueda({
      titulo: 'Fallo',
      descriptores: ['recurso de casación', 'admisibilidad'],
    });

    expect(texto).toContain('recurso de casacion');
    expect(texto).toContain('admisibilidad');
  });
});
