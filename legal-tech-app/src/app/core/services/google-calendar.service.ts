import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GoogleCalendarService {
  private apiUrl = `${environment.apiUrl}/calendar`;

  constructor(private http: HttpClient) {}

  getAuthUrl(): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.apiUrl}/auth`);
  }

  // The callback is handled by the browser redirecting to the backend, 
  // or we can handle code here if we use popup flow.
  // Current backend implementation suggests backend redirect. 
  // Let's assume we redirect user to the URL we get.
}
