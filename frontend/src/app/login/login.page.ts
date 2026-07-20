import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuController, AlertController } from '@ionic/angular/standalone';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
  IonInput, IonButton, IonInputPasswordToggle, IonToast
} from '@ionic/angular/standalone';
import { Router, RouterModule } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { ApiService } from '../services/api';
import { PushNotificationsService } from '../services/push-notifications';
import { UserSettingsService } from '../services/user-settings';
import { LocationService } from '../services/location';

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
  viewMode: 'login' | 'forgot-choose' | 'forgot-input' | 'reset' = 'login';
  otpChannel: 'email' | 'phone' | null = null;
  resetData = { email: '', phone: '', otp: '', new_password: '' };

  isLoggingIn    = false;
  isSendingOtp   = false;
  isResettingPwd = false;

  toastOpen = false;
  toastMessage = '';
  toastColor = 'danger';

  private attemptCount = 0;
  private readonly MAX_ATTEMPTS = 5;
  private lockoutUntil = 0;
  lockoutSecsRemaining = 0;
  private lockoutInterval: any;

  constructor(
    private router: Router,
    private api: ApiService,
    private menuCtrl: MenuController,
    private alertCtrl: AlertController,
    private pushNotificationsService: PushNotificationsService,
    private settings: UserSettingsService,
    private locationSvc: LocationService,
  ) {}

  ionViewWillEnter() {
    this.menuCtrl.enable(false);
    this.isLoggingIn = false;
    this.viewMode = 'login';
    // Always force light mode on the login page.
    document.documentElement.classList.remove('ion-palette-dark');
    document.documentElement.classList.remove('reduce-animations');
  }

  ionViewWillLeave() {
    this.menuCtrl.enable(true);
    clearInterval(this.lockoutInterval);
  }

  login() {
    const now = Date.now();
    if (this.lockoutUntil > now) {
      const secs = Math.ceil((this.lockoutUntil - now) / 1000);
      this.showToast(`Too many attempts. Try again in ${secs}s.`, 'warning'); return;
    }
    if (!this.credentials.login || !this.credentials.password) {
      this.showToast('Please enter both email/username and password.', 'warning'); return;
    }
    this.isLoggingIn = true;
    this.api.login(this.credentials).subscribe({
      next: (res: any) => {
        if (Capacitor.isNativePlatform() && (res.role === 'admin' || res.role === 'dispatcher')) {
          this.isLoggingIn = false;
          this.showToast('Admin access is not available on the mobile app.', 'danger'); return;
        }
        this.attemptCount = 0;
        this.api.setToken(res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        localStorage.setItem('role', res.role);

        this.settings.loadFromServer(res.user.user_id).then(() => {
          this.locationSvc.start();
          const target = (res.role === 'admin' || res.role === 'dispatcher')
            ? '/admin-dashboard' : '/tabs/home';

          this.router.navigate([target]).then(() => {
            // Apply dark mode AFTER navigation completes AND after a full
            // animation frame so it never bleeds back onto the login page.
            requestAnimationFrame(() => {
              this.settings.applyToDom();
            });
            if (res.role !== 'admin' && res.role !== 'dispatcher') {
              this.pushNotificationsService.registerPush(res.user.user_id);
            }
          });
        });
      },
      error: (err: any) => {
        this.isLoggingIn = false;
        if (err.status === 0 || err.status >= 500 || !navigator.onLine) return;
        this.attemptCount++;
        const remaining = this.MAX_ATTEMPTS - this.attemptCount;
        if (this.attemptCount >= this.MAX_ATTEMPTS) {
          this.lockoutUntil = Date.now() + 30_000;
          this.attemptCount = 0;
          this.showToast('Too many failed attempts. Locked out for 30 seconds.', 'danger');
          this.lockoutSecsRemaining = 30;
          clearInterval(this.lockoutInterval);
          this.lockoutInterval = setInterval(() => {
            const r = Math.ceil((this.lockoutUntil - Date.now()) / 1000);
            this.lockoutSecsRemaining = r > 0 ? r : 0;
            if (this.lockoutSecsRemaining === 0) clearInterval(this.lockoutInterval);
          }, 500);
        } else if (err.status === 403) {
          this.showToast('Your account has been suspended. Contact the admin.', 'danger');
        } else {
          this.showToast(`Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, 'danger');
        }
      }
    });
  }

  chooseOtpChannel(channel: 'email' | 'phone') {
    this.otpChannel = channel;
    this.viewMode = 'forgot-input';
  }

  requestReset() {
    if (this.otpChannel === 'email' && !this.resetData.email) {
      this.showToast('Please enter your email.', 'warning'); return;
    }
    if (this.otpChannel === 'phone' && !this.resetData.phone) {
      this.showToast('Please enter your phone number.', 'warning'); return;
    }
    const payload = this.otpChannel === 'email'
      ? { email: this.resetData.email, otp_channel: 'email' }
      : { phone: this.resetData.phone, otp_channel: 'phone' };
    this.isSendingOtp = true;
    this.api.forgotPassword(payload).subscribe({
      next: () => { this.isSendingOtp = false; this.showToast('Recovery OTP sent.', 'success'); this.viewMode = 'reset'; },
      error: () => { this.isSendingOtp = false; this.showToast(
        this.otpChannel === 'email' ? 'Email not found.' : 'Phone number not found.', 'danger'
      ); }
    });
  }

  confirmReset() {
    if (!this.resetData.otp || !this.resetData.new_password) { this.showToast('Fill out all fields.', 'warning'); return; }
    const payload = this.otpChannel === 'email'
      ? { email: this.resetData.email, otp: this.resetData.otp, new_password: this.resetData.new_password, otp_channel: 'email' }
      : { phone: this.resetData.phone, otp: this.resetData.otp, new_password: this.resetData.new_password, otp_channel: 'phone' };
    this.isResettingPwd = true;
    this.api.resetPassword(payload).subscribe({
      next: () => {
        this.isResettingPwd = false;
        this.showToast('Password reset! You can now log in.', 'success');
        this.viewMode = 'login';
        this.resetData = { email: '', phone: '', otp: '', new_password: '' };
        this.otpChannel = null;
      },
      error: (err: any) => { this.isResettingPwd = false; this.showToast(err.error?.message || 'Invalid OTP or weak password.', 'danger'); }
    });
  }

  showToast(msg: string, color = 'danger') {
    this.toastMessage = msg; this.toastColor = color; this.toastOpen = false;
    setTimeout(() => { this.toastOpen = true; }, 10);
  }
}
