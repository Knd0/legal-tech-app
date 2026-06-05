import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Expediente } from '../models/expediente.model';
import { Observable, tap } from 'rxjs';
import { PaginatedResponse } from '../models/paginated-response.model';

@Injectable({
  providedIn: 'root'
})
export class ExpedienteService {

  private expedientesSignal = signal<Expediente[]>([]);

  readonly expedientes = computed(() => this.expedientesSignal());

  private readonly API_URL = `${environment.apiUrl}/expedientes`;

  constructor(private http: HttpClient) {
    this.loadExpedientes();
  }

  getPaginatedExpedientes(page: number, limit: number, search?: string, estado?: string): Observable<PaginatedResponse<Expediente>> {
    const params: any = { page: page.toString(), limit: limit.toString() };
    if (search) {
      params.search = search;
    }
    if (estado) {
      params.estado = estado;
    }
    return this.http.get<PaginatedResponse<Expediente>>(this.API_URL, { params });
  }

  loadExpedientes() {
      this.http.get<Expediente[]>(this.API_URL).subscribe({
          next: (data) => this.expedientesSignal.set(data),
          error: (err) => console.error('Failed to load expedientes', err)
      });
  }

  getExpedienteById(id: string): Expediente | undefined {
    return this.expedientesSignal().find(e => e.id === id);
  }

  getExpedientesByClientId(clientId: string): Expediente[] {
    return this.expedientesSignal().filter(e => e.cliente?.id === clientId || e.clienteId === clientId);
  }

  addExpediente(expediente: Omit<Expediente, 'id'>): void {
    // Backend generates ID
    this.http.post<Expediente>(this.API_URL, expediente).subscribe({
      next: (newExp) => {
        this.expedientesSignal.update(list => [...list, newExp]);
      },
      error: (err) => console.error('Failed to create expediente', err)
    });
  }

  updateExpediente(id: string, updatedData: Partial<Expediente>): void {
    this.http.put<void>(`${this.API_URL}/${id}`, updatedData).subscribe({
      next: () => {
        this.expedientesSignal.update(list =>
          list.map(e => e.id === id ? { ...e, ...updatedData } : e)
        );
      },
      error: (err) => console.error('Failed to update expediente', err)
    });
  }

  updateExpedienteKanban(id: string, estado: string, onError: () => void, onComplete: () => void): void {
    this.http.put<void>(`${this.API_URL}/${id}`, { estado }).subscribe({
      next: () => {
        this.expedientesSignal.update(list =>
          list.map(e => e.id === id ? { ...e, estado: estado as any } : e)
        );
        onComplete();
      },
      error: () => {
        onError();
      }
    });
  }

  deleteExpediente(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`).pipe(
      tap(() => {
        this.expedientesSignal.update(list => list.filter(e => e.id !== id));
      })
    );
  }
}
