import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface SupportTicket {
  id: string;
  asunto: string;
  descripcion: string;
  status: 'open' | 'resolved';
  userId: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupportService {
  private apiUrl = `${environment.apiUrl}/support-tickets`;

  constructor(private http: HttpClient) { }

  createTicket(asunto: string, descripcion: string): Observable<SupportTicket> {
    return this.http.post<SupportTicket>(this.apiUrl, { asunto, descripcion });
  }

  getTickets(): Observable<SupportTicket[]> {
    return this.http.get<SupportTicket[]>(this.apiUrl);
  }

  resolveTicket(id: string): Observable<SupportTicket> {
    return this.http.patch<SupportTicket>(`${this.apiUrl}/${id}/resolve`, {});
  }
}
