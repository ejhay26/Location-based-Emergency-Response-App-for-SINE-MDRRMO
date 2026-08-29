import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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

  /** Lightweight backend health probe (/api/health) */
  healthCheck(): Observable<any> {
    return this.http.get(`${this.url}/health`, this.opts(false));
  }

  // ── File URL helpers ─────────────────────────────────────────────────
  resolveFileUrl(path: string | null | undefined): string {
    if (!path || path.trim() === '') return '';
    if (path.includes('ionicframework.com')) return '';
    if (path.startsWith('data:') || path.startsWith('blob:')) return path;

    let relative = path;
    if (/^https?:\/\//i.test(path)) {
      const storageMatch = path.match(/\/(storage\/.+)$/);
      if (storageMatch) {
        relative = storageMatch[1];
      } else {
        const reportsMatch = path.match(/\/(reports\/.+)$/);
        if (reportsMatch) relative = reportsMatch[1];
        else return path;
      }
    }
    const cleanPath = relative.replace(/^storage\//, '').replace(/^\/+/, '');
    return `${this.apiOrigin}/storage-proxy/${cleanPath}`;
  }

  resolveImageUrl(path: string | null | undefined): string {
    return this.resolveFileUrl(path);
  }

  constructor(private http: HttpClient) {}

  // ── Public (no token) ────────────────────────────────────────────────
  login(data: any): Observable<any>                { return this.http.post(`${this.url}/login`, data, this.opts()); }
  loginSendOtp(data: any): Observable<any>          { return this.http.post(`${this.url}/login-send-otp`, data, this.opts()); }
  loginVerifyOtp(data: any): Observable<any>        { return this.http.post(`${this.url}/login-verify-otp`, data, this.opts()); }
  register(data: any): Observable<any>             { return this.http.post(`${this.url}/register`, data, this.opts()); }
  verifyOtp(data: any): Observable<any>            { return this.http.post(`${this.url}/verify-otp`, data, this.opts()); }
  resendRegistrationOtp(data: any): Observable<any> { return this.http.post(`${this.url}/resend-registration-otp`, data, this.opts()); }
  checkVerificationStatus(identifier: string): Observable<any> { return this.http.post(`${this.url}/check-verification-status`, { login: identifier }, this.opts()); }
  checkUsername(username: string, extra?: { first_name?: string; last_name?: string; barangay?: string; birthdate?: string }): Observable<any> {
    let params = `username=${encodeURIComponent(username)}`;
    if (extra?.first_name) params += `&first_name=${encodeURIComponent(extra.first_name)}`;
    if (extra?.last_name)  params += `&last_name=${encodeURIComponent(extra.last_name)}`;
    if (extra?.barangay)   params += `&barangay=${encodeURIComponent(extra.barangay)}`;
    if (extra?.birthdate)  params += `&birthdate=${encodeURIComponent(extra.birthdate)}`;
    return this.http.get(`${this.url}/check-username?${params}`, this.opts());
  }
  checkEmail(email: string): Observable<any>       { return this.http.get(`${this.url}/check-email?email=${email}`, this.opts()); }
  forgotPassword(data: any): Observable<any>       { return this.http.post(`${this.url}/forgot-password`, data, this.opts()); }
  verifyResetOtp(data: any): Observable<any>       { return this.http.post(`${this.url}/verify-reset-otp`, data, this.opts()); }
  resetPassword(data: any): Observable<any>        { return this.http.post(`${this.url}/reset-password`, data, this.opts()); }

  // Read-only feeds (require login — backend now enforces auth:sanctum here too)
  getActiveEmergencies(): Observable<any>          { return this.http.get(`${this.url}/active-emergencies`, this.opts(true)); }
  getActiveHazards(): Observable<any>              { return this.http.get(`${this.url}/active-hazards`, this.opts(true)); }
  getActiveBroadcast(): Observable<any>            { return this.http.get(`${this.url}/active-broadcast`, this.opts(true)); }
  getDispatchAssets(): Observable<any>             { return this.http.get(`${this.url}/dispatch-assets`, this.opts(true)); }
  getAnalytics(days: number): Observable<any>      { return this.http.get(`${this.url}/analytics?days=${days}`, this.opts(true)); }
  getArchivedEmergencies(): Observable<any>        { return this.http.get(`${this.url}/archived-emergencies`, this.opts(true)); }

  static isLoggingOut = false;

  // ── Authenticated ────────────────────────────────────────────────────
  logout(): Observable<any> {
    ApiService.isLoggingOut = true;
    return this.http.post(`${this.url}/logout`, {}, this.opts(true));
  }
  savePushToken(data: any): Observable<any>        { return this.http.post(`${this.url}/save-push-token`, data, this.opts(true)); }
  deletePushToken(data: { token: string }): Observable<any> { return this.http.post(`${this.url}/delete-push-token`, data, this.opts(true)); }

  // Profile
  updateProfilePicture(data: any): Observable<any>    { return this.http.post(`${this.url}/update-profile-picture`, data, this.opts(true)); }
  sendPasswordChangeOtp(data: any): Observable<any>   { return this.http.post(`${this.url}/send-password-change-otp`, data, this.opts(true)); }
  verifyPasswordChangeOtp(data: any): Observable<any> { return this.http.post(`${this.url}/verify-password-change-otp`, data, this.opts(true)); }
  updatePassword(data: any): Observable<any>          { return this.http.post(`${this.url}/update-password`, data, this.opts(true)); }
  updateMedicalProfile(data: any): Observable<any>    { return this.http.post(`${this.url}/update-medical-profile`, data, this.opts(true)); }
  completeAccountSetup(userId: number): Observable<any> { return this.http.post(`${this.url}/complete-account-setup`, { user_id: userId }, this.opts(true)); }

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
  createBroadcast(data: { title?: string; message: string; media_files?: string[]; barangay_ids?: number[] }): Observable<any> { return this.http.post(`${this.url}/create-broadcast`, data, this.opts(true)); }
  clearBroadcast(broadcastId: number): Observable<any> { return this.http.post(`${this.url}/clear-broadcast`, { broadcast_id: broadcastId }, this.opts(true)); }

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
  issueStrike(data: { user_id: number; reason: string }): Observable<any> { return this.http.post(`${this.url}/issue-strike`, data, this.opts(true)); }
  resetStrikes(data: { user_id: number; reason?: string }): Observable<any> { return this.http.post(`${this.url}/reset-strikes`, data, this.opts(true)); }
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
  forwardFeedbackBug(id: number, data?: { admin_notes?: string }): Observable<any> {
    return this.http.post(`${this.url}/feedback/${id}/forward-bug`, data || {}, this.opts(true));
  }
  archiveFeedback(id: number): Observable<any>    { return this.http.post(`${this.url}/feedback/${id}/archive`, {}, this.opts(true)); }
  restoreFeedback(id: number): Observable<any>    { return this.http.post(`${this.url}/feedback/${id}/restore`, {}, this.opts(true)); }
  purgeFeedbackTrash(): Observable<any>           { return this.http.post(`${this.url}/feedback/purge`, {}, this.opts(true)); }
}

