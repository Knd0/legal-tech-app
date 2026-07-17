import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LegalModel {
  id?: string;
  titulo: string;
  tipoEscrito: string;
  fuero: string;
  contenido: string;
  tags?: string;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LegalModelService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/legal-models`;

  findAll(q?: string, fuero?: string, tipoEscrito?: string, page = 1, limit = 10): Observable<{ data: LegalModel[], total: number }> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (q) params = params.set('q', q);
    if (fuero) params = params.set('fuero', fuero);
    if (tipoEscrito) params = params.set('tipoEscrito', tipoEscrito);

    return this.http.get<{ data: LegalModel[], total: number }>(this.apiUrl, { params });
  }

  findOne(id: string): Observable<LegalModel> {
    return this.http.get<LegalModel>(`${this.apiUrl}/${id}`);
  }

  create(data: Partial<LegalModel>): Observable<LegalModel> {
    return this.http.post<LegalModel>(this.apiUrl, data);
  }

  update(id: string, data: Partial<LegalModel>): Observable<LegalModel> {
    return this.http.patch<LegalModel>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
