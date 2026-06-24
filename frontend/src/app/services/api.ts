import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {

  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Helper method to dynamically generate ngrok bypass headers
  private getNgrokHeaders() {
    return {
      headers: new HttpHeaders({
        'ngrok-skip-browser-warning': 'true'
      })
    };
  }

  // ── Auth ────────────────────────────────────────────────────────────
  login(data: any): Observable<any>               { return this.http.post(`${this.url}/login`, data, this.getNgrokHeaders()); }
  register(data: any): Observable<any>            { return this.http.post(`${this.url}/register`, data, this.getNgrokHeaders()); }
  verifyOtp(data: any): Observable<any>           { return this.http.post(`${this.url}/verify-otp`, data, this.getNgrokHeaders()); }
  checkUsername(username: string): Observable<any>{ return this.http.get(`${this.url}/check-username?username=${username}`, this.getNgrokHeaders()); }
  checkEmail(email: string): Observable<any>      { return this.http.get(`${this.url}/check-email?email=${email}`, this.getNgrokHeaders()); }
  forgotPassword(data: any): Observable<any>      { return this.http.post(`${this.url}/forgot-password`, data, this.getNgrokHeaders()); }
  resetPassword(data: any): Observable<any>       { return this.http.post(`${this.url}/reset-password`, data, this.getNgrokHeaders()); }

  // ── Profile ─────────────────────────────────────────────────────────
  updateProfilePicture(data: any): Observable<any>  { return this.http.post(`${this.url}/update-profile-picture`, data, this.getNgrokHeaders()); }
  updatePassword(data: any): Observable<any>        { return this.http.post(`${this.url}/update-password`, data, this.getNgrokHeaders()); }
  updateMedicalProfile(data: any): Observable<any>  { return this.http.post(`${this.url}/update-medical-profile`, data, this.getNgrokHeaders()); }

  // ── Emergencies ─────────────────────────────────────────────────────
  submitSos(data: any): Observable<any>           { return this.http.post(`${this.url}/submit-sos`, data, this.getNgrokHeaders()); }
  cancelEmergency(data: any): Observable<any>     { return this.http.post(`${this.url}/cancel-sos`, data, this.getNgrokHeaders()); }
  getMyEmergencies(userId: number): Observable<any>{ return this.http.get(`${this.url}/my-emergencies/${userId}`, this.getNgrokHeaders()); }
  getActiveEmergencies(): Observable<any>         { return this.http.get(`${this.url}/active-emergencies`, this.getNgrokHeaders()); }
  getArchivedEmergencies(): Observable<any>       { return this.http.get(`${this.url}/archived-emergencies`, this.getNgrokHeaders()); }
  getDispatchAssets(): Observable<any>            { return this.http.get(`${this.url}/dispatch-assets`, this.getNgrokHeaders()); }
  dispatchEmergency(data: any): Observable<any>   { return this.http.post(`${this.url}/dispatch-emergency`, data, this.getNgrokHeaders()); }
  resolveEmergency(data: any): Observable<any>    { return this.http.post(`${this.url}/resolve-emergency`, data, this.getNgrokHeaders()); }

  // ── Hazards ─────────────────────────────────────────────────────────
  submitHazard(data: any): Observable<any>        { return this.http.post(`${this.url}/submit-hazard`, data, this.getNgrokHeaders()); }
  getActiveHazards(): Observable<any>             { return this.http.get(`${this.url}/active-hazards`, this.getNgrokHeaders()); }
  resolveHazard(data: any): Observable<any>       { return this.http.post(`${this.url}/resolve-hazard`, data, this.getNgrokHeaders()); }

  // ── Broadcasts ──────────────────────────────────────────────────────
  createBroadcast(data: any): Observable<any>     { return this.http.post(`${this.url}/create-broadcast`, data, this.getNgrokHeaders()); }
  getActiveBroadcast(): Observable<any>           { return this.http.get(`${this.url}/active-broadcast`, this.getNgrokHeaders()); }
  clearBroadcast(): Observable<any>               { return this.http.post(`${this.url}/clear-broadcast`, {}, this.getNgrokHeaders()); }

  // ── Analytics ───────────────────────────────────────────────────────
  getAnalytics(days: number): Observable<any>     { return this.http.get(`${this.url}/analytics?days=${days}`, this.getNgrokHeaders()); }

  // ── ID Verifications ────────────────────────────────────────────────
  getPendingVerifications(): Observable<any>      { return this.http.get(`${this.url}/pending-verifications`, this.getNgrokHeaders()); }
  approveUser(data: any): Observable<any>         { return this.http.post(`${this.url}/approve-user`, data, this.getNgrokHeaders()); }
  rejectUser(data: any): Observable<any>          { return this.http.post(`${this.url}/reject-user`, data, this.getNgrokHeaders()); }

  // ── Dispatcher Management ───────────────────────────────────────────
  getDispatchers(): Observable<any>               { return this.http.get(`${this.url}/dispatchers`, this.getNgrokHeaders()); }
  createDispatcher(data: any): Observable<any>    { return this.http.post(`${this.url}/create-dispatcher`, data, this.getNgrokHeaders()); }
  updateDispatcher(data: any): Observable<any>    { return this.http.post(`${this.url}/update-dispatcher`, data, this.getNgrokHeaders()); }
  deactivateDispatcher(data: any): Observable<any>{ return this.http.post(`${this.url}/deactivate-dispatcher`, data, this.getNgrokHeaders()); }
}