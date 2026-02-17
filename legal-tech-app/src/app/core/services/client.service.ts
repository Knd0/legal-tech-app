import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Cliente, Familiar } from '../models/cliente.model';

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

  loadClients() {
    this.http.get<Cliente[]>(this.API_URL).subscribe({
      next: (data) => this.clientsSignal.set(data),
      error: (err) => console.error('Failed to load clients', err)
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
      error: (err) => console.error('Failed to create client', err)
    });
  }

  getClientById(id: string): Cliente | undefined {
     return this.clientsSignal().find(c => c.id === id);
  }

  updateClient(id: string, updatedData: Partial<Cliente>): void {
    this.http.put<void>(`${this.API_URL}/${id}`, updatedData).subscribe({
      next: () => {
        this.clientsSignal.update(clients => 
          clients.map(client => client.id === id ? { ...client, ...updatedData } : client)
        );
      },
      error: (err) => console.error('Failed to update client', err)
    });
  }

  deleteClient(id: string): void {
    this.http.delete<void>(`${this.API_URL}/${id}`).subscribe({
        next: () => {
            this.clientsSignal.update(clients => clients.filter(c => c.id !== id));
        },
        error: (err) => console.error('Failed to delete client', err)
    });
  }
}
