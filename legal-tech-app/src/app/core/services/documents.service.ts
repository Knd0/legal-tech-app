import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Documento {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  path: string;
  clientId?: string;
  expedienteId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentsService {
  private apiUrl = `${environment.apiUrl}/documents`;
  private http = inject(HttpClient);

  upload(file: File, clientId?: string, expedienteId?: string): Observable<Documento> {
    const formData = new FormData();
    formData.append('file', file);
    
    let params = new HttpParams();
    if (clientId) params = params.set('clientId', clientId);
    if (expedienteId) params = params.set('expedienteId', expedienteId);

    return this.http.post<Documento>(`${this.apiUrl}/upload`, formData, { params });
  }

  findAll(clientId?: string, expedienteId?: string): Observable<Documento[]> {
    let params = new HttpParams();
    if (clientId) params = params.set('clientId', clientId);
    if (expedienteId) params = params.set('expedienteId', expedienteId);

    return this.http.get<Documento[]>(this.apiUrl, { params });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  downloadUrl(id: string): string {
      return `${this.apiUrl}/${id}/download`;
  }

  getBlob(id: string): Observable<Blob> {
      return this.http.get(`${this.apiUrl}/${id}/view`, { responseType: 'blob' });
  }
}
