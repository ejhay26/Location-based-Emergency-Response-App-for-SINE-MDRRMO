import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuController } from '@ionic/angular/standalone';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
  IonInput, IonButton, IonInputPasswordToggle, IonToast
} from '@ionic/angular/standalone';
import { Router, RouterModule } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { ApiService } from '../../../core/services/api';
import { PushNotificationsService } from '../../../core/services/push-notifications';
import { UserSettingsService } from '../../../core/services/user-settings';
import { LocationService } from '../../../core/services/location';

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
  showPassword = false;
  viewMode: 'login' | 'login-otp-choose' | 'email-otp' | 'forgot-choose' | 'forgot-input' | 'reset' = 'login';
  otpChannel: 'email' | 'phone' | null = null;
  resetData = { email: '', phone: '', otp: '', new_password: '' };

  isLoggingIn    = false;
  isSendingOtp   = false;
  isVerifyingOtp = false;
  isResettingPwd = false;

  // ── OTP login (email or phone) ──────────────────────────────────────────
  loginOtpChannel: 'email' | 'phone' | null = null;
  emailOtpData    = { email: '', phone: '', otp: '' };
  otpSent         = false;
  otpResendSecs   = 0;
  private resendInterval: any;

  get emailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.emailOtpData.email);
  }

  get loginPhoneValid(): boolean {
    return /^(\+63|0)9\d{9}$/.test(this.emailOtpData.phone.replace(/[\s-]/g, ''));
  }

  /** Whichever identifier field is relevant for the currently chosen login-OTP channel. */
  get loginOtpIdentifierValid(): boolean {
    return this.loginOtpChannel === 'phone' ? this.loginPhoneValid : this.emailValid;
  }

  startResendCountdown() {
    this.otpResendSecs = 60;
    clearInterval(this.resendInterval);
    this.resendInterval = setInterval(() => {
      this.otpResendSecs--;
      if (this.otpResendSecs <= 0) clearInterval(this.resendInterval);
    }, 1000);
  }

  sendLoginOtp() {
    if (!this.loginOtpIdentifierValid) {
      this.showToast(
        this.loginOtpChannel === 'phone' ? 'Please enter a valid phone number.' : 'Please enter a valid email address.',
        'warning'
      );
      return;
    }
    if (this.otpResendSecs > 0) return;
    const channelLabel = this.loginOtpChannel === 'phone' ? 'phone' : 'email';
    const payload = this.loginOtpChannel === 'phone'
      ? { otp_channel: 'phone', phone: this.emailOtpData.phone }
      : { otp_channel: 'email', email: this.emailOtpData.email };
    this.isSendingOtp = true;
    this.api.loginSendOtp(payload).subscribe({
      next: () => {
        this.isSendingOtp = false;
        this.otpSent = true;
        this.startResendCountdown();
        this.showToast(`OTP sent — check your ${channelLabel}.`, 'success');
      },
      error: (err: any) => {
        this.isSendingOtp = false;
        if (err.status === 403) {
          this.showToast('Your account is pending admin verification.', 'warning');
        } else if (err.status === 500) {
          this.showToast(err.error?.message || 'Failed to send SMS OTP. Try email instead.', 'danger');
        } else {
          this.otpSent = true;
          this.startResendCountdown();
          this.showToast(`OTP sent — check your ${channelLabel}.`, 'success');
        }
      }
    });
  }

  verifyLoginOtp() {
    if (!this.emailOtpData.otp || this.emailOtpData.otp.length < 4) {
      this.showToast('Please enter the 4-digit code.', 'warning'); return;
    }
    const payload = this.loginOtpChannel === 'phone'
      ? { otp_channel: 'phone', phone: this.emailOtpData.phone, otp: this.emailOtpData.otp }
      : { otp_channel: 'email', email: this.emailOtpData.email, otp: this.emailOtpData.otp };
    this.isVerifyingOtp = true;
    this.api.loginVerifyOtp(payload).subscribe({
      next: (res: any) => { this.isVerifyingOtp = false; this.handleLoginSuccess(res); },
      error: (err: any) => {
        this.isVerifyingOtp = false;
        this.showToast(err.error?.message || 'Invalid or expired code.', 'danger');
      }
    });
  }

  /** "Login with OTP instead" — show the email/phone channel picker first. */
  startLoginOtp() {
    this.viewMode = 'login-otp-choose';
    this.loginOtpChannel = null;
    this.emailOtpData = { email: '', phone: '', otp: '' };
    this.otpSent = false;
    this.otpResendSecs = 0;
    clearInterval(this.resendInterval);
  }

  chooseLoginOtpChannel(channel: 'email' | 'phone') {
    this.loginOtpChannel = channel;
    this.emailOtpData = { email: '', phone: '', otp: '' };
    this.otpSent = false;
    this.otpResendSecs = 0;
    clearInterval(this.resendInterval);
    this.viewMode = 'email-otp';
  }

  private handleLoginSuccess(res: any) {
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
        requestAnimationFrame(() => { this.settings.applyToDom(); });
        if (res.role !== 'admin' && res.role !== 'dispatcher') {
          this.pushNotificationsService.registerPush(res.user.user_id);
        }
      });
    });
  }

  toastOpen    = false;
  toastMessage = '';
  toastColor   = 'danger';

  private attemptCount = 0;
  private readonly MAX_ATTEMPTS = 5;
  private lockoutUntil = 0;
  lockoutSecsRemaining = 0;
  private lockoutInterval: any;

  resetPwdLength = false;
  resetPwdUpper  = false;
  resetPwdLower  = false;
  resetPwdNum    = false;
  resetPwdSym    = false;

  onResetPasswordInput() {
    const p = this.resetData.new_password;
    this.resetPwdLength = p.length >= 8;
    this.resetPwdUpper  = /[A-Z]/.test(p);
    this.resetPwdLower  = /[a-z]/.test(p);
    this.resetPwdNum    = /\d/.test(p);
    this.resetPwdSym    = /[@$!%*#?&]/.test(p);
  }

  constructor(
    private router: Router,
    private api: ApiService,
    private menuCtrl: MenuController,
    private pushNotificationsService: PushNotificationsService,
    private settings: UserSettingsService,
    private locationSvc: LocationService,
  ) {}

  ionViewWillEnter() {
    this.menuCtrl.enable(false);
    this.isLoggingIn = false;
    this.viewMode = 'login';
    this.showPassword = false;
    document.documentElement.classList.remove('ion-palette-dark');
    document.documentElement.classList.remove('reduce-animations');
  }

  ionViewWillLeave() {
    this.menuCtrl.enable(true);
    clearInterval(this.lockoutInterval);
    clearInterval(this.resendInterval);
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
      next: (res: any) => { this.isLoggingIn = false; this.handleLoginSuccess(res); },
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
      next: () => {
        this.isSendingOtp = false;
        this.showToast('Recovery OTP sent.', 'success');
        this.viewMode = 'reset';
        this.resetData.new_password = '';
        this.onResetPasswordInput();
      },
      error: () => {
        this.isSendingOtp = false;
        this.showToast(
          this.otpChannel === 'email' ? 'Email not found.' : 'Phone number not found.', 'danger'
        );
      }
    });
  }

  confirmReset() {
    if (!this.resetData.otp) { this.showToast('Please enter the OTP code.', 'warning'); return; }
    if (!this.resetData.new_password) { this.showToast('Please enter a new password.', 'warning'); return; }
    if (!this.resetPwdLength || !this.resetPwdUpper || !this.resetPwdLower || !this.resetPwdNum || !this.resetPwdSym) {
      this.showToast('Password does not meet all requirements.', 'warning'); return;
    }
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
        this.onResetPasswordInput();
      },
      error: (err: any) => {
        this.isResettingPwd = false;
        this.showToast(err.error?.message || 'Invalid OTP or weak password.', 'danger');
      }
    });
  }

  showToast(msg: string, color = 'danger') {
    this.toastMessage = msg; this.toastColor = color; this.toastOpen = false;
    setTimeout(() => { this.toastOpen = true; }, 10);
  }
}
