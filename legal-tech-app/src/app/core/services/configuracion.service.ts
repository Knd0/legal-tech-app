import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';

export interface SystemSetting {
  key: string;
  value: string;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfiguracionService {
  private apiUrl = `${environment.apiUrl}/settings`;
  
  // Signals for easy access
  valorJus = signal<number>(0);
  valorUma = signal<number>(0);

  constructor(private http: HttpClient) {
    this.loadSettings();
  }

  loadSettings() {
    return this.http.get<SystemSetting[]>(this.apiUrl).pipe(
      tap(settings => {
        const jus = settings.find(s => s.key === 'VALOR_JUS_ENTRE_RIOS');
        const uma = settings.find(s => s.key === 'VALOR_UMA_NACION');
        
        if (jus) this.valorJus.set(Number(jus.value));
        if (uma) this.valorUma.set(Number(uma.value));
      })
    ).subscribe();
  }

  updateSetting(key: string, value: string) {
    return this.http.put<SystemSetting>(`${this.apiUrl}/${key}`, { value }).pipe(
      tap(updated => {
        if (updated.key === 'VALOR_JUS_ENTRE_RIOS') this.valorJus.set(Number(updated.value));
        if (updated.key === 'VALOR_UMA_NACION') this.valorUma.set(Number(updated.value));
      })
    );
  }
}
