import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {

  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Auth ────────────────────────────────────────────────────────────
  login(data: any): Observable<any>               { return this.http.post(`${this.url}/login`, data); }
  register(data: any): Observable<any>            { return this.http.post(`${this.url}/register`, data); }
  verifyOtp(data: any): Observable<any>           { return this.http.post(`${this.url}/verify-otp`, data); }
  checkUsername(username: string): Observable<any>{ return this.http.get(`${this.url}/check-username?username=${username}`); }
  checkEmail(email: string): Observable<any>      { return this.http.get(`${this.url}/check-email?email=${email}`); }
  forgotPassword(data: any): Observable<any>      { return this.http.post(`${this.url}/forgot-password`, data); }
  resetPassword(data: any): Observable<any>       { return this.http.post(`${this.url}/reset-password`, data); }

  // ── Profile ─────────────────────────────────────────────────────────
  updateProfilePicture(data: any): Observable<any>  { return this.http.post(`${this.url}/update-profile-picture`, data); }
  updatePassword(data: any): Observable<any>        { return this.http.post(`${this.url}/update-password`, data); }
  updateMedicalProfile(data: any): Observable<any>  { return this.http.post(`${this.url}/update-medical-profile`, data); }

  // ── Emergencies ─────────────────────────────────────────────────────
  submitSos(data: any): Observable<any>           { return this.http.post(`${this.url}/submit-sos`, data); }
  cancelEmergency(data: any): Observable<any>     { return this.http.post(`${this.url}/cancel-sos`, data); }
  getMyEmergencies(userId: number): Observable<any>{ return this.http.get(`${this.url}/my-emergencies/${userId}`); }
  getActiveEmergencies(): Observable<any>         { return this.http.get(`${this.url}/active-emergencies`); }
  getArchivedEmergencies(): Observable<any>       { return this.http.get(`${this.url}/archived-emergencies`); }
  getDispatchAssets(): Observable<any>            { return this.http.get(`${this.url}/dispatch-assets`); }
  dispatchEmergency(data: any): Observable<any>   { return this.http.post(`${this.url}/dispatch-emergency`, data); }
  resolveEmergency(data: any): Observable<any>    { return this.http.post(`${this.url}/resolve-emergency`, data); }

  // ── Hazards ─────────────────────────────────────────────────────────
  submitHazard(data: any): Observable<any>        { return this.http.post(`${this.url}/submit-hazard`, data); }
  getActiveHazards(): Observable<any>             { return this.http.get(`${this.url}/active-hazards`); }
  resolveHazard(data: any): Observable<any>       { return this.http.post(`${this.url}/resolve-hazard`, data); }

  // ── Broadcasts ──────────────────────────────────────────────────────
  createBroadcast(data: any): Observable<any>     { return this.http.post(`${this.url}/create-broadcast`, data); }
  getActiveBroadcast(): Observable<any>           { return this.http.get(`${this.url}/active-broadcast`); }
  clearBroadcast(): Observable<any>               { return this.http.post(`${this.url}/clear-broadcast`, {}); }

  // ── Analytics ───────────────────────────────────────────────────────
  getAnalytics(days: number): Observable<any>     { return this.http.get(`${this.url}/analytics?days=${days}`); }

  // ── ID Verifications ────────────────────────────────────────────────
  getPendingVerifications(): Observable<any>      { return this.http.get(`${this.url}/pending-verifications`); }
  approveUser(data: any): Observable<any>         { return this.http.post(`${this.url}/approve-user`, data); }
  rejectUser(data: any): Observable<any>          { return this.http.post(`${this.url}/reject-user`, data); }

  // ── Dispatcher Management ───────────────────────────────────────────
  getDispatchers(): Observable<any>               { return this.http.get(`${this.url}/dispatchers`); }
  createDispatcher(data: any): Observable<any>    { return this.http.post(`${this.url}/create-dispatcher`, data); }
  updateDispatcher(data: any): Observable<any>    { return this.http.post(`${this.url}/update-dispatcher`, data); }
  deactivateDispatcher(data: any): Observable<any>{ return this.http.post(`${this.url}/deactivate-dispatcher`, data); }
}