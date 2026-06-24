import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuController } from '@ionic/angular';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
  IonInput, IonButton, IonInputPasswordToggle, IonToast
} from '@ionic/angular/standalone';
import { Router, RouterModule } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
    IonInput, IonButton, IonInputPasswordToggle, IonToast
  ],
})
export class LoginPage {

  credentials = { login: '', password: '' };
  viewMode: 'login' | 'forgot' | 'reset' = 'login';
  resetData = { email: '', otp: '', new_password: '' };

  toastOpen = false;
  toastMessage = '';
  toastColor = 'danger';

  private attemptCount = 0;
  private readonly MAX_ATTEMPTS = 5;
  private lockoutUntil = 0;

  constructor(private router: Router, private api: ApiService, private menuCtrl: MenuController) {}

  ionViewWillEnter() { this.menuCtrl.enable(false); }
  ionViewWillLeave() { this.menuCtrl.enable(true); }

  login() {
    const now = Date.now();
    if (this.lockoutUntil > now) {
      const secs = Math.ceil((this.lockoutUntil - now) / 1000);
      this.showToast(`Too many attempts. Try again in ${secs}s.`, 'warning'); return;
    }
    if (!this.credentials.login || !this.credentials.password) {
      this.showToast('Please enter both email/username and password.', 'warning'); return;
    }
    this.api.login(this.credentials).subscribe({
      next: (res: any) => {
        // Block admin/dispatcher accounts on native mobile (Android/iOS)
        if (Capacitor.isNativePlatform() && (res.role === 'admin' || res.role === 'dispatcher')) {
          this.showToast('Admin access is not available on the mobile app.', 'danger'); return;
        }
        this.attemptCount = 0;
        localStorage.setItem('user', JSON.stringify(res.user));
        localStorage.setItem('role', res.role);
        if (res.role === 'admin' || res.role === 'dispatcher') {
          this.router.navigate(['/admin-dashboard']);
        } else {
          this.router.navigate(['/home']);
        }
      },
      error: (err: any) => {
        // Network/server errors are handled globally by ErrorInterceptorService
        // Don't count them as failed login attempts
        if (err.status === 0 || err.status >= 500 || !navigator.onLine) return;

        this.attemptCount++;
        const remaining = this.MAX_ATTEMPTS - this.attemptCount;
        if (this.attemptCount >= this.MAX_ATTEMPTS) {
          this.lockoutUntil = Date.now() + 30_000;
          this.attemptCount = 0;
          this.showToast('Too many failed attempts. Locked out for 30 seconds.', 'danger');
        } else if (err.status === 403) {
          this.showToast('Your account has been suspended. Contact the admin.', 'danger');
        } else {
          this.showToast(`Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, 'danger');
        }
      }
    });
  }

  requestReset() {
    if (!this.resetData.email) { this.showToast('Please enter your email.', 'warning'); return; }
    this.api.forgotPassword({ email: this.resetData.email }).subscribe({
      next: () => { this.showToast('Recovery OTP sent to your email.', 'success'); this.viewMode = 'reset'; },
      error: () => this.showToast('Email not found.', 'danger')
    });
  }

  confirmReset() {
    if (!this.resetData.otp || !this.resetData.new_password) { this.showToast('Fill out all fields.', 'warning'); return; }
    this.api.resetPassword(this.resetData).subscribe({
      next: () => { this.showToast('Password reset! You can now log in.', 'success'); this.viewMode = 'login'; this.resetData = { email: '', otp: '', new_password: '' }; },
      error: (err: any) => this.showToast(err.error?.message || 'Invalid OTP or weak password.', 'danger')
    });
  }

  showToast(msg: string, color = 'danger') {
    this.toastMessage = msg; this.toastColor = color; this.toastOpen = false;
    setTimeout(() => { this.toastOpen = true; }, 10);
  }
}