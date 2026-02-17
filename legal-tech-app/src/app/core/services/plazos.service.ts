import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PlazosService {

  constructor() { }

  /**
   * Calcula la fecha de vencimiento sumando días hábiles a una fecha inicial.
   * Saltea sábados, domingos y fechas indicadas en 'feriados'.
   * 
   * @param fechaInicial Fecha desde la cual se empieza a contar.
   * @param diasHabiles Cantidad de días hábiles a sumar.
   * @param feriados Lista de fechas (Feriados o Ferias Judiciales) a excluir.
   * @returns La nueva fecha de vencimiento.
   */
  calcularVencimiento(fechaInicial: Date, diasHabiles: number, feriados: Date[] = []): Date {
    // Clonamos la fecha para no mutar el objeto original
    const resultado = new Date(fechaInicial);
    let diasSumados = 0;

    // Normalizamos feriados para comparar solo fechas (sin horas)
    const feriadosStrings = new Set(feriados.map(f => this.formatDate(f)));

    while (diasSumados < diasHabiles) {
      // Avanzamos un día
      resultado.setDate(resultado.getDate() + 1);

      // Verificamos si es hábil
      if (this.esDiaHabil(resultado, feriadosStrings)) {
        diasSumados++;
      }
    }

    return resultado;
  }

  /**
   * Verifica si una fecha es día hábil (Lunes a Viernes y no es feriado).
   */
  private esDiaHabil(fecha: Date, feriadosStrings: Set<string>): boolean {
    const diaSemana = fecha.getDay();
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6; // 0 = Domingo, 6 = Sábado
    
    if (esFinDeSemana) {
      return false;
    }

    const fechaStr = this.formatDate(fecha);
    if (feriadosStrings.has(fechaStr)) {
      return false;
    }

    return true;
  }

  /**
   * Formatea fecha a YYYY-MM-DD para comparación simple.
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
