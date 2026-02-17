import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';

export interface Movimiento {
  id: string;
  tipo: 'HONORARIO' | 'GASTO' | 'PAGO' | 'REGULADO' | 'CONVENIO';
  unidad: 'PESOS' | 'JUS' | 'UMA';
  cantidad?: number;
  monto: number;
  montoPesoOriginal?: number;
  porcentaje?: number;
  estado: 'PENDIENTE' | 'PAGADO' | 'PARCIAL';
  fecha: Date | string;
  descripcion: string;
  clientId: string;
  expedienteId?: string;
  createdAt?: Date;
}

export interface Balance {
  totalHonorarios: number;
  totalGastos: number;
  totalPagos: number;
  balance: number;
  movimientos: Movimiento[];
}

@Injectable({
  providedIn: 'root'
})
export class MovimientoService {
  private apiUrl = `${environment.apiUrl}/movimientos`;

  constructor(private http: HttpClient) {}

  getBalance(clientId: string) {
    return this.http.get<Balance>(`${this.apiUrl}/client/${clientId}/balance`);
  }

  create(movimiento: Partial<Movimiento>) {
    return this.http.post<Movimiento>(this.apiUrl, movimiento);
  }

  createFactura(movimiento: Movimiento) {
      return this.http.post<any>(`${environment.apiUrl}/facturas`, {
          clientId: movimiento.clientId,
          total: movimiento.monto
      });
  }

  getFacturasByClient(clientId: string) {
      return this.http.get<any[]>(`${environment.apiUrl}/facturas/client/${clientId}`);
  }
}
