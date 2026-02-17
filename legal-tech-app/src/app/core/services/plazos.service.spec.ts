import { PlazosService } from './plazos.service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('PlazosService', () => {
  let service: PlazosService;

  beforeEach(() => {
    service = new PlazosService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add simple business days (Mon -> Tue)', () => {
    // Lunes 1 de Enero (Supongamos que no es feriado para el test simple)
    const inicio = new Date(2024, 0, 1); // Lunes
    const resultado = service.calcularVencimiento(inicio, 1);
    expect(resultado.getDay()).toBe(2); // Martes
    expect(resultado.getDate()).toBe(2);
  });

  it('should skip weekends (Fri + 1 day = Mon)', () => {
    const viernes = new Date(2024, 0, 5); // Viernes 5 Enero
    const resultado = service.calcularVencimiento(viernes, 1);
    
    // Sábado 6, Domingo 7 -> Lunes 8
    expect(resultado.getDay()).toBe(1); // Lunes
    expect(resultado.getDate()).toBe(8);
  });

  it('should skip holidays provided in the array', () => {
    const inicio = new Date(2024, 0, 10); // Miércoles 10 Enero
    // Queremos sumar 2 días hábiles.
    // Jueves 11 (Feriado mockeado)
    // Viernes 12 (Hábil 1)
    // Sábado 13 (Fin de semana)
    // Domingo 14 (Fin de semana)
    // Lunes 15 (Hábil 2) -> Resultado esperado
    
    const feriados = [new Date(2024, 0, 11)]; // Jueves 11
    const resultado = service.calcularVencimiento(inicio, 2, feriados);

    expect(resultado.getDate()).toBe(15);
  });
});
