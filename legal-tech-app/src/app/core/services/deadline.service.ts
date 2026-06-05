import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Vencimiento } from '../models/vencimiento.model';

@Injectable({
  providedIn: 'root'
})
export class DeadlineService {

  private deadlinesSignal = signal<Vencimiento[]>([]);

  readonly deadlines = computed(() => this.deadlinesSignal().sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime()));

  private readonly API_URL = `${environment.apiUrl}/deadlines`;

  constructor(private http: HttpClient) {
    this.loadDeadlines();
  }

  loadDeadlines() {
    this.http.get<Vencimiento[]>(this.API_URL).subscribe({
      next: (data) => this.deadlinesSignal.set(data),
      error: (err) => console.error('Failed to load deadlines', err)
    });
  }

  getDeadlines() {
    return this.deadlines;
  }

  addDeadline(deadline: Omit<Vencimiento, 'id'>): void {
    this.http.post<Vencimiento>(this.API_URL, deadline).subscribe({
      next: (newDeadline) => {
        this.deadlinesSignal.update(list => [...list, newDeadline]);
      },
      error: (err) => console.error('Failed to create deadline', err)
    });
  }

  deleteDeadline(id: string): void {
    this.http.delete<void>(`${this.API_URL}/${id}`).subscribe({
      next: () => {
        this.deadlinesSignal.update(list => list.filter(d => d.id !== id));
      },
      error: (err) => console.error('Failed to delete deadline', err)
    });
  }

  updateDeadline(deadline: Vencimiento): void {
    // Separate ID from body if needed, or send whole object
    const { id, ...data } = deadline;
    this.http.put<void>(`${this.API_URL}/${id}`, data).subscribe({
      next: () => {
        this.deadlinesSignal.update(list => list.map(d => d.id === id ? deadline : d));
      },
      error: (err) => console.error('Failed to update deadline', err)
    });
  }

  markAsCompleted(id: string): void {
     this.http.put<void>(`${this.API_URL}/${id}`, { estado: 'CUMPLIDO' }).subscribe({
      next: () => {
        this.deadlinesSignal.update(list => 
          list.map(d => d.id === id ? { ...d, estado: 'CUMPLIDO' } : d)
        );
      },
      error: (err) => console.error('Failed to mark as completed', err)
    });
  }

  // Basic client-side check, ideally backend handles status updates via Cron
  checkExpiration(): void {
    // This is visual only for now, backend cron handles notifications
    const today = new Date();
    today.setHours(0,0,0,0);

    this.deadlinesSignal.update(list => 
      list.map(d => {
        const deadlineDate = new Date(d.fechaVencimiento);
        deadlineDate.setHours(0,0,0,0);

        if (d.estado === 'PENDIENTE' && deadlineDate < today) {
          return { ...d, estado: 'EXPIRADO' };
        }
        return d;
      })
    );
  }

  analyzePdf(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.API_URL}/analyze-pdf`, formData);
  }
}
