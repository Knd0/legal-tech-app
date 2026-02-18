import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role: 'ADMIN' | 'USER';
  isActive: boolean;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) { }

  getUsers(): Observable<User[]> {
      return this.http.get<User[]>(this.apiUrl);
  }

  createUser(user: any): Observable<User> {
      return this.http.post<User>(this.apiUrl, user);
  }

  suspendUser(id: string): Observable<User> {
      return this.http.patch<User>(`${this.apiUrl}/${id}/suspend`, {});
  }

  updateUser(id: string, user: any): Observable<User> {
      return this.http.patch<User>(`${this.apiUrl}/${id}`, user);
  }

  deleteUser(id: string): Observable<void> {
      return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
