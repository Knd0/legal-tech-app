import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  userId: string;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  private apiUrl = `${environment.apiUrl}/audit-logs`;
  
  recentLogs = signal<AuditLog[]>([]);

  constructor(private http: HttpClient) {}

  loadRecentLogs() {
    this.http.get<AuditLog[]>(`${this.apiUrl}/recent`).subscribe({
      next: (logs) => this.recentLogs.set(logs),
      error: (err) => console.error('Failed to load audit logs', err)
    });
  }
}
