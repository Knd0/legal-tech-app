import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Cliente, Familiar } from '../models/cliente.model';
import { Observable, tap } from 'rxjs';
import { PaginatedResponse } from '../models/paginated-response.model';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  
  // State managed by Signal
  private clientsSignal = signal<Cliente[]>([]);

  // Exposed Read-Only Signal
  readonly clients = computed(() => this.clientsSignal());

  private readonly API_URL = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {
    this.loadClients();
  }

  getPaginatedClients(page: number, limit: number, search?: string): Observable<PaginatedResponse<Cliente>> {
    const params: any = { page: page.toString(), limit: limit.toString() };
    if (search) {
      params.search = search;
    }
    return this.http.get<PaginatedResponse<Cliente>>(this.API_URL, { params });
  }

  loadClients() {
    this.http.get<Cliente[]>(this.API_URL).subscribe({
      next: (data) => this.clientsSignal.set(data),
      error: () => Swal.fire({ icon: 'error', title: 'Error al cargar clientes', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 })
    });
  }

  getClienteById(id: string): Cliente | undefined {
    return this.clientsSignal().find(c => c.id === id);
  }

  addClient(cliente: Omit<Cliente, 'id' | 'fechaAlta'>): void {
    const newClient = {
        ...cliente,
        fechaAlta: new Date(),
        // Backend handles ID generation usually, but we can send without ID
    };

    this.http.post<Cliente>(this.API_URL, newClient).subscribe({
      next: (createdClient) => {
        this.clientsSignal.update(clients => [...clients, createdClient]);
      },
      error: () => Swal.fire({ icon: 'error', title: 'Error al crear cliente', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 })
    });
  }

  getClientById(id: string): Cliente | undefined {
     return this.clientsSignal().find(c => c.id === id);
  }

  getClientByIdHttp(id: string): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.API_URL}/${id}`);
  }

  updateClient(id: string, updatedData: Partial<Cliente>): void {
    this.http.put<void>(`${this.API_URL}/${id}`, updatedData).subscribe({
      next: () => {
        this.clientsSignal.update(clients => 
          clients.map(client => client.id === id ? { ...client, ...updatedData } : client)
        );
      },
      error: () => Swal.fire({ icon: 'error', title: 'Error al actualizar cliente', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 })
    });
  }

  deleteClient(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`).pipe(
      tap(() => {
        this.clientsSignal.update(clients => clients.filter(c => c.id !== id));
      })
    );
  }
}
