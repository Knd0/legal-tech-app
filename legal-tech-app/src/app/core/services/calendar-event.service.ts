import { Injectable, signal, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CalendarEvent } from '../models/calendar-event.model';
import Swal from 'sweetalert2';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CalendarEventService {
  private readonly apiUrl = `${environment.apiUrl}/calendar`;
  private eventsSignal = signal<CalendarEvent[]>([]);
  readonly events = this.eventsSignal.asReadonly();

  private authService = inject(AuthService);

  constructor(private http: HttpClient) {
    // Mismo problema y misma solución que `DeadlineService`: el servicio se
    // instancia antes del login, así que se reacciona al estado de sesión en
    // lugar de leer el token una única vez.
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.loadEvents();
      } else {
        this.eventsSignal.set([]);
      }
    });
  }

  loadEvents() {
    this.http.get<CalendarEvent[]>(this.apiUrl).subscribe({
      next: (data) => this.eventsSignal.set(data),
      error: () => Swal.fire({ icon: 'error', title: 'Error al cargar eventos', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 }),
    });
  }

  addEvent(data: Omit<CalendarEvent, 'id' | 'createdAt'>): void {
    this.http.post<CalendarEvent>(this.apiUrl, data).subscribe({
      next: (ev) => this.eventsSignal.update(list => [...list, ev]),
      error: () => Swal.fire({ icon: 'error', title: 'Error al crear evento', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 }),
    });
  }

  updateEvent(id: string, data: Partial<CalendarEvent>): void {
    this.http.patch<CalendarEvent>(`${this.apiUrl}/${id}`, data).subscribe({
      next: (ev) => this.eventsSignal.update(list => list.map(e => e.id === id ? ev : e)),
      error: () => Swal.fire({ icon: 'error', title: 'Error al actualizar evento', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 }),
    });
  }

  deleteEvent(id: string): void {
    this.http.delete<void>(`${this.apiUrl}/${id}`).subscribe({
      next: () => this.eventsSignal.update(list => list.filter(e => e.id !== id)),
      error: () => Swal.fire({ icon: 'error', title: 'Error al eliminar evento', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 }),
    });
  }
}
