import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {

  private url = environment.apiUrl;

  get apiOrigin(): string {
    return this.url.replace(/\/api\/?$/, '');
  }

  // ── Token storage ────────────────────────────────────────────────────
  setToken(token: string): void { localStorage.setItem('api_token', token); }
  clearToken(): void            { localStorage.removeItem('api_token'); }
  getToken(): string | null     { return localStorage.getItem('api_token'); }

  private baseHeaders(): Record<string, string> {
    return { 'ngrok-skip-browser-warning': 'true' };
  }

  private authHeaders(): Record<string, string> {
    const headers = this.baseHeaders();
    const token = this.getToken();
    if (token) { headers['Authorization'] = `Bearer ${token}`; }
    return headers;
  }

  private opts(auth = false) {
    return { headers: new HttpHeaders(auth ? this.authHeaders() : this.baseHeaders()) };
  }

  // ── File URL helpers ─────────────────────────────────────────────────
  resolveFileUrl(path: string | null | undefined): string {
    if (!path) return '';
    if (path.includes('ionicframework.com')) return '';
    if (path.startsWith('data:')) return path;
    if (/^https?:\/\//i.test(path) && path.includes('/storage/')) {
      path = path.replace(/^https?:\/\/[^/]+\//, '');
    }
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.apiOrigin}/${path.replace(/^\/+/, '')}`;
  }

  resolveImageUrl(path: string | null | undefined): string {
    return this.resolveFileUrl(path);
  }

  constructor(private http: HttpClient) {}

  // ── Public (no token) ────────────────────────────────────────────────
  login(data: any): Observable<any>                { return this.http.post(`${this.url}/login`, data, this.opts()); }
  register(data: any): Observable<any>             { return this.http.post(`${this.url}/register`, data, this.opts()); }
  verifyOtp(data: any): Observable<any>            { return this.http.post(`${this.url}/verify-otp`, data, this.opts()); }
  checkUsername(username: string): Observable<any> { return this.http.get(`${this.url}/check-username?username=${username}`, this.opts()); }
  checkEmail(email: string): Observable<any>       { return this.http.get(`${this.url}/check-email?email=${email}`, this.opts()); }
  forgotPassword(data: any): Observable<any>       { return this.http.post(`${this.url}/forgot-password`, data, this.opts()); }
  resetPassword(data: any): Observable<any>        { return this.http.post(`${this.url}/reset-password`, data, this.opts()); }

  // Public read-only feeds
  getActiveEmergencies(): Observable<any>          { return this.http.get(`${this.url}/active-emergencies`, this.opts()); }
  getActiveHazards(): Observable<any>              { return this.http.get(`${this.url}/active-hazards`, this.opts()); }
  getActiveBroadcast(): Observable<any>            { return this.http.get(`${this.url}/active-broadcast`, this.opts()); }
  getDispatchAssets(): Observable<any>             { return this.http.get(`${this.url}/dispatch-assets`, this.opts()); }
  getAnalytics(days: number): Observable<any>      { return this.http.get(`${this.url}/analytics?days=${days}`, this.opts()); }
  getArchivedEmergencies(): Observable<any>        { return this.http.get(`${this.url}/archived-emergencies`, this.opts()); }

  // ── Authenticated ────────────────────────────────────────────────────
  logout(): Observable<any>                        { return this.http.post(`${this.url}/logout`, {}, this.opts(true)); }
  savePushToken(data: any): Observable<any>        { return this.http.post(`${this.url}/save-push-token`, data, this.opts(true)); }

  // Profile
  updateProfilePicture(data: any): Observable<any>    { return this.http.post(`${this.url}/update-profile-picture`, data, this.opts(true)); }
  sendPasswordChangeOtp(data: any): Observable<any>   { return this.http.post(`${this.url}/send-password-change-otp`, data, this.opts(true)); }
  verifyPasswordChangeOtp(data: any): Observable<any> { return this.http.post(`${this.url}/verify-password-change-otp`, data, this.opts(true)); }
  updatePassword(data: any): Observable<any>          { return this.http.post(`${this.url}/update-password`, data, this.opts(true)); }
  updateMedicalProfile(data: any): Observable<any>    { return this.http.post(`${this.url}/update-medical-profile`, data, this.opts(true)); }

  // Settings
  getSettings(userId: number): Observable<any>    { return this.http.get(`${this.url}/settings/${userId}`, this.opts(true)); }
  saveSetting(data: { user_id: number; key: string; value: string }): Observable<any> { return this.http.post(`${this.url}/settings`, data, this.opts(true)); }

  // Emergencies
  submitSos(data: any): Observable<any>           { return this.http.post(`${this.url}/submit-sos`, data, this.opts(true)); }
  cancelEmergency(data: any): Observable<any>     { return this.http.post(`${this.url}/cancel-sos`, data, this.opts(true)); }
  getMyEmergencies(userId: number): Observable<any> { return this.http.get(`${this.url}/my-emergencies/${userId}`, this.opts(true)); }
  markFalseAlarm(data: { request_id: number }): Observable<any> { return this.http.post(`${this.url}/mark-false-alarm`, data, this.opts(true)); }

  // Hazards
  submitHazard(data: any): Observable<any>        { return this.http.post(`${this.url}/submit-hazard`, data, this.opts(true)); }
  resolveHazard(data: any): Observable<any>       { return this.http.post(`${this.url}/resolve-hazard`, data, this.opts(true)); }

  // Broadcasts
  createBroadcast(data: any): Observable<any>     { return this.http.post(`${this.url}/create-broadcast`, data, this.opts(true)); }
  clearBroadcast(): Observable<any>               { return this.http.post(`${this.url}/clear-broadcast`, {}, this.opts(true)); }

  // Admin / dispatcher
  getPendingVerifications(): Observable<any>      { return this.http.get(`${this.url}/pending-verifications`, this.opts(true)); }
  approveUser(data: any): Observable<any>         { return this.http.post(`${this.url}/approve-user`, data, this.opts(true)); }
  rejectUser(data: any): Observable<any>          { return this.http.post(`${this.url}/reject-user`, data, this.opts(true)); }
  getCitizens(filters?: { search?: string; status?: string }): Observable<any> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    return this.http.get(`${this.url}/citizens${qs ? '?' + qs : ''}`, this.opts(true));
  }
  suspendCitizen(data: any): Observable<any>      { return this.http.post(`${this.url}/suspend-citizen`, data, this.opts(true)); }
  reactivateCitizen(data: any): Observable<any>   { return this.http.post(`${this.url}/reactivate-citizen`, data, this.opts(true)); }
  dispatchEmergency(data: any): Observable<any>   { return this.http.post(`${this.url}/dispatch-emergency`, data, this.opts(true)); }
  resolveEmergency(data: any): Observable<any>    { return this.http.post(`${this.url}/resolve-emergency`, data, this.opts(true)); }
  getDispatchers(): Observable<any>               { return this.http.get(`${this.url}/dispatchers`, this.opts(true)); }
  createDispatcher(data: any): Observable<any>    { return this.http.post(`${this.url}/create-dispatcher`, data, this.opts(true)); }
  updateDispatcher(data: any): Observable<any>    { return this.http.post(`${this.url}/update-dispatcher`, data, this.opts(true)); }
  deactivateDispatcher(data: any): Observable<any>{ return this.http.post(`${this.url}/deactivate-dispatcher`, data, this.opts(true)); }

  // Feedback
  submitFeedback(data: any): Observable<any>      { return this.http.post(`${this.url}/feedback`, data, this.opts(true)); }
  getFeedback(): Observable<any>                  { return this.http.get(`${this.url}/feedback`, this.opts(true)); }
  clearFeedback(): Observable<any>                { return this.http.post(`${this.url}/feedback/clear`, {}, this.opts(true)); }
  exportFeedbackUrl(): string                     { return `${this.url}/feedback/export`; }
}
