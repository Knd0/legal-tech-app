import { Injectable, inject } from '@angular/core';
import { ConfiguracionService } from './configuracion.service';

@Injectable({
  providedIn: 'root'
})
export class CalculoHonorariosService {
  private configService = inject(ConfiguracionService);

  convertir(cantidad: number, unidad: 'PESOS' | 'JUS' | 'UMA'): number {
    if (unidad === 'PESOS') return cantidad;
    if (unidad === 'JUS') return cantidad * this.configService.valorJus();
    if (unidad === 'UMA') return cantidad * this.configService.valorUma();
    return 0;
  }

  calcularPorcentaje(base: number, porcentaje: number): number {
    return (base * porcentaje) / 100;
  }
}
