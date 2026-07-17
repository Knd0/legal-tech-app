import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/ai`;

  analyze(text: string, context?: string): Observable<{ analysis: string }> {
    return this.http.post<{ analysis: string }>(`${this.apiUrl}/analyze`, { text, context });
  }

  generateDraft(expedienteId: string, tipoEscrito: string, extraInstructions?: string, modelId?: string): Observable<{ draft: string }> {
    return this.http.post<{ draft: string }>(`${this.apiUrl}/draft`, { expedienteId, tipoEscrito, extraInstructions, modelId });
  }

  summarizeExpediente(expedienteId: string): Observable<{ summary: string }> {
    return this.http.post<{ summary: string }>(`${this.apiUrl}/summarize-expediente`, { expedienteId });
  }

  analyzeRisk(expedienteId: string): Observable<{ riskAnalysis: string, successProbability: number, weakPoints: string[], strongPoints: string[] }> {
    return this.http.post<any>(`${this.apiUrl}/analyze-risk`, { expedienteId });
  }

  analyzeCosts(data: {
    montoReclamo: number;
    jurisdiccion: string;
    tipoProceso: string;
    requiereMediacion: boolean;
    requierePerito: boolean;
    cantidadNotificaciones: number;
    extraDetails?: string;
    valorJus: number;
    valorUma: number;
  }): Observable<{ analysis: string }> {
    return this.http.post<{ analysis: string }>(`${this.apiUrl}/analyze-costs`, data);
  }

  analyzePdf(documentId: string, question: string): Observable<{ analysis: string }> {
    return this.http.post<{ analysis: string }>(`${this.apiUrl}/analyze-pdf`, { documentId, question });
  }

  extractDeadlines(documentId: string): Observable<any[]> {
    return this.http.post<any[]>(`${this.apiUrl}/extract-deadlines`, { documentId });
  }
}
