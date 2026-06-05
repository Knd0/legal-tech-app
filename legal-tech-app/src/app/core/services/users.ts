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
  subscriptionStatus?: string;
  subscriptionExpiresAt?: Date;
  createdAt?: string;
}

export interface UserPage {
  data: User[];
  total: number;
  page: number;
  limit: number;
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

  getUsersPaginated(page: number, limit: number, search?: string, status?: string): Observable<UserPage> {
    const params: any = { page, limit };
    if (search) params['search'] = search;
    if (status) params['status'] = status;
    return this.http.get<UserPage>(this.apiUrl, { params });
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
