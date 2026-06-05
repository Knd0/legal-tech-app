import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CalendarEvent } from '../models/calendar-event.model';

@Injectable({ providedIn: 'root' })
export class CalendarEventService {
  private readonly apiUrl = `${environment.apiUrl}/calendar`;
  private eventsSignal = signal<CalendarEvent[]>([]);
  readonly events = this.eventsSignal.asReadonly();

  constructor(private http: HttpClient) {
    this.loadEvents();
  }

  loadEvents() {
    this.http.get<CalendarEvent[]>(this.apiUrl).subscribe({
      next: (data) => this.eventsSignal.set(data),
      error: (err) => console.error('Error loading calendar events', err),
    });
  }

  addEvent(data: Omit<CalendarEvent, 'id' | 'createdAt'>): void {
    this.http.post<CalendarEvent>(this.apiUrl, data).subscribe({
      next: (ev) => this.eventsSignal.update(list => [...list, ev]),
      error: (err) => console.error('Error creating calendar event', err),
    });
  }

  updateEvent(id: string, data: Partial<CalendarEvent>): void {
    this.http.patch<CalendarEvent>(`${this.apiUrl}/${id}`, data).subscribe({
      next: (ev) => this.eventsSignal.update(list => list.map(e => e.id === id ? ev : e)),
      error: (err) => console.error('Error updating calendar event', err),
    });
  }

  deleteEvent(id: string): void {
    this.http.delete<void>(`${this.apiUrl}/${id}`).subscribe({
      next: () => this.eventsSignal.update(list => list.filter(e => e.id !== id)),
      error: (err) => console.error('Error deleting calendar event', err),
    });
  }
}
