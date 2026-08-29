import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuController } from '@ionic/angular/standalone';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem,
  IonInput, IonButton, IonInputPasswordToggle, IonToast
} from '@ionic/angular/standalone';
import { Router, RouterModule } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { ApiService } from '../../../core/services/api';
import { DialogService } from '../../../core/services/dialog.service';
import { PushNotificationsService } from '../../../core/services/push-notifications';
import { UserSettingsService } from '../../../core/services/user-settings';
import { LocationService } from '../../../core/services/location';
import { TourService } from '../../../core/services/tour';
import { DeepLinkService } from '../../../core/services/deep-link';
import { formatPhoneLocalPart, isValidPhonePH } from '../../../shared/utils/phone.util';
import { OtpAutofillService } from '../../../core/services/otp-autofill';
import { OtpBoxInputComponent } from '../../../shared/components/otp-box-input/otp-box-input.component';
import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonItem,
    IonInput, IonButton, IonInputPasswordToggle, IonToast,
    OtpBoxInputComponent, AppIconComponent
  ],
})
export class LoginPage {

  credentials = { login: '', password: '' };
  showPassword = false;
  viewMode: 'login' | 'login-otp-choose' | 'email-otp' | 'forgot-choose' | 'forgot-input' = 'login';
  otpChannel: 'email' | 'phone' | null = null;
  resetData = { email: '', phone: '', otp: '', new_password: '', confirm_password: '' };
  /** True once a recovery OTP has been sent for the current forgot-password attempt; reveals the 4-box code entry. */
  resetOtpSent = false;
  /** True once that code has actually been verified against the backend; only then are the new-password fields shown. */
  resetOtpVerified = false;

  isLoggingIn        = false;
  isSendingOtp       = false;
  isVerifyingOtp     = false;
  isVerifyingResetOtp = false;
  isResettingPwd     = false;

  // ── OTP login (email or phone) ──────────────────────────────────────────
  loginOtpChannel: 'email' | 'phone' | null = null;
  emailOtpData    = { email: '', phone: '', otp: '' };
  otpSent         = false;
  otpResendSecs   = 0;
  private resendInterval: any;

  /**
   * 10-digit local parts only, bound directly to their respective inputs.
   * emailOtpData.phone / resetData.phone hold the full "63XXXXXXXXXX"
   * canonical value used for actual submission — see onOtpPhoneInput() /
   * onResetPhoneInput(). Same split-state pattern as register.page.ts.
   */
  otpPhoneLocal   = '';
  resetPhoneLocal = '';

  onOtpPhoneInput(raw: string | null | undefined): void {
    this.otpPhoneLocal = formatPhoneLocalPart(raw ?? '');
    this.emailOtpData.phone = this.otpPhoneLocal.length === 10 ? '63' + this.otpPhoneLocal : '';
  }

  onResetPhoneInput(raw: string | null | undefined): void {
    this.resetPhoneLocal = formatPhoneLocalPart(raw ?? '');
    this.resetData.phone = this.resetPhoneLocal.length === 10 ? '63' + this.resetPhoneLocal : '';
  }

  get emailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.emailOtpData.email);
  }

  get loginPhoneValid(): boolean {
    return isValidPhonePH(this.emailOtpData.phone);
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
        const successMsg = this.loginOtpChannel === 'email'
          ? 'OTP sent! Please check your inbox and spam/junk folder.'
          : 'OTP sent — check your SMS messages.';
        this.showToast(successMsg, 'success');
        if (this.loginOtpChannel === 'phone') {
          this.otpAutofill.listen(code => { this.emailOtpData.otp = code; this.verifyLoginOtp(); });
        }
      },
      error: (err: any) => {
        this.isSendingOtp = false;
        if (err.status === 403) {
          // Phone-channel OTP requests can't be resolved by the status-check
          // endpoint below (it only looks up by email/username), so those
          // just get the toast; email-channel ones go to the Pending screen.
          if (err.error?.reason === 'unverified' && this.loginOtpChannel === 'email') {
            this.router.navigate(['/pending-verification'], { queryParams: { login: this.emailOtpData.email } });
          } else {
            this.showToast('Your account is pending admin verification.', 'warning');
          }
        } else if (err.status === 500) {
          this.showToast(err.error?.message || 'Failed to send SMS OTP. Try email instead.', 'danger');
        } else {
          this.otpSent = true;
          this.startResendCountdown();
          const msg = this.loginOtpChannel === 'email'
            ? 'OTP sent! Please check your inbox and spam/junk folder.'
            : 'OTP sent — check your SMS messages.';
          this.showToast(msg, 'success');
        }
      }
    });
  }

  verifyLoginOtp() {
    if (!this.emailOtpData.otp || this.emailOtpData.otp.length < 6) {
      this.showToast('Please enter the 6-digit code.', 'warning'); return;
    }
    const payload = this.loginOtpChannel === 'phone'
      ? { otp_channel: 'phone', phone: this.emailOtpData.phone, otp: this.emailOtpData.otp }
      : { otp_channel: 'email', email: this.emailOtpData.email, otp: this.emailOtpData.otp };
    this.isVerifyingOtp = true;
    this.api.loginVerifyOtp(payload).subscribe({
      next: (res: any) => { this.isVerifyingOtp = false; this.otpAutofill.stop(); this.handleLoginSuccess(res); },
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
    this.otpPhoneLocal = '';
    this.otpSent = false;
    this.otpResendSecs = 0;
    clearInterval(this.resendInterval);
    this.otpAutofill.stop();
  }

  chooseLoginOtpChannel(channel: 'email' | 'phone') {
    this.loginOtpChannel = channel;
    this.emailOtpData = { email: '', phone: '', otp: '' };
    this.otpPhoneLocal = '';
    this.otpSent = false;
    this.otpResendSecs = 0;
    clearInterval(this.resendInterval);
    this.otpAutofill.stop();
    this.viewMode = 'email-otp';
  }

  private handleLoginSuccess(res: any) {
    this.attemptCount = 0;
    this.api.setToken(res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    localStorage.setItem('role', res.role);
    this.settings.loadFromServer(res.user.user_id).then(() => {
      this.locationSvc.start();
      const isCitizen = res.role !== 'admin' && res.role !== 'dispatcher';
      // First-login citizens (server-persisted flag, not device localStorage)
      // go through the Account Setup flow first; it offers the tour itself
      // at its final step, so the old promptStart() alert is no longer
      // fired from here.
      const needsSetup = isCitizen && !res.user.setup_completed;
      // A widget/external-launch deep link (e.g. Report) takes priority over
      // the default home tab, but never over first-time Account Setup — a
      // brand-new citizen still has to complete setup before anything else.
      const pendingDeepLink = isCitizen && !needsSetup ? this.deepLink.consumePendingDeepLink() : null;
      const target = (res.role === 'admin' || res.role === 'dispatcher')
        ? '/admin-dashboard'
        : (needsSetup ? '/account-setup' : (pendingDeepLink ?? '/tabs/home'));
      // navigateByUrl (not navigate([target])) — target may carry a query
      // string (e.g. '/report?type=hazard' from a deferred widget deep
      // link), and router.navigate() with an array only parses path
      // segments, not embedded '?' query strings.
      this.router.navigateByUrl(target).then(() => {
        requestAnimationFrame(() => { this.settings.applyToDom(); });
        // Register push notifications on mobile for all authenticated accounts (citizens & admins/dispatchers)
        this.pushNotificationsService.registerPush(res.user.user_id);
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
    private dialog: DialogService,
    private menuCtrl: MenuController,
    private pushNotificationsService: PushNotificationsService,
    private settings: UserSettingsService,
    private locationSvc: LocationService,
    private tour: TourService,
    private otpAutofill: OtpAutofillService,
    private deepLink: DeepLinkService,
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
    this.otpAutofill.stop();
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
          if (err.error?.reason === 'unverified') {
            this.router.navigate(['/pending-verification'], { queryParams: { login: this.credentials.login } });
          } else {
            this.showToast('Your account has been suspended. Contact the admin.', 'danger');
          }
        } else {
          this.showToast(`Invalid email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, 'danger');
        }
      }
    });
  }

  chooseOtpChannel(channel: 'email' | 'phone') {
    this.otpChannel = channel;
    this.resetData = { email: '', phone: '', otp: '', new_password: '', confirm_password: '' };
    this.resetPhoneLocal = '';
    this.resetOtpSent = false;
    this.resetOtpVerified = false;
    this.otpResendSecs = 0;
    clearInterval(this.resendInterval);
    this.viewMode = 'forgot-input';
  }

  get resetIdentifierValid(): boolean {
    return this.otpChannel === 'phone' ? isValidPhonePH(this.resetData.phone) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.resetData.email);
  }

  /** Masked identifier shown as a locked/verified summary once resetOtpVerified — same masking shape as profile.page.ts's maskEmail/maskPhone. */
  get maskedResetIdentifier(): string {
    if (this.otpChannel === 'phone') {
      const p = this.resetPhoneLocal;
      return p.length < 4 ? p : '+63 ' + p.slice(0, 3) + '*'.repeat(Math.max(p.length - 4, 0)) + p.slice(-1);
    }
    const [local, domain] = this.resetData.email.split('@');
    if (!domain) return this.resetData.email;
    const maskedLocal = local.length <= 2
      ? local[0] + '*'.repeat(Math.max(local.length - 1, 1))
      : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
    return maskedLocal + '@' + domain;
  }

  requestReset() {
    if (!this.resetIdentifierValid) {
      this.showToast(
        this.otpChannel === 'phone' ? 'Please enter a valid phone number.' : 'Please enter a valid email address.', 'warning'
      ); return;
    }
    if (this.otpResendSecs > 0) return;
    const payload = this.otpChannel === 'email'
      ? { email: this.resetData.email, otp_channel: 'email' }
      : { phone: this.resetData.phone, otp_channel: 'phone' };
    this.isSendingOtp = true;
    this.api.forgotPassword(payload).subscribe({
      next: () => {
        this.isSendingOtp = false;
        this.resetOtpSent = true;
        this.resetOtpVerified = false;
        this.startResendCountdown();
        this.showToast('Recovery OTP sent.', 'success');
        this.resetData.otp = '';
        this.resetData.new_password = '';
        this.resetData.confirm_password = '';
        this.onResetPasswordInput();
      },
      error: (err: any) => {
        this.isSendingOtp = false;
        this.showToast(
          this.otpChannel === 'email' ? 'Email not found.' : 'Phone number not found.', 'danger'
        );
      }
    });
  }

  /** Confirms the entered code is correct before revealing the new-password fields — see AuthController::verifyResetOtp(). */
  verifyResetOtp() {
    if (!this.resetData.otp || this.resetData.otp.length < 6) {
      this.showToast('Please enter the 6-digit code.', 'warning'); return;
    }
    const payload = this.otpChannel === 'email'
      ? { email: this.resetData.email, otp: this.resetData.otp, otp_channel: 'email' }
      : { phone: this.resetData.phone, otp: this.resetData.otp, otp_channel: 'phone' };
    this.isVerifyingResetOtp = true;
    this.api.verifyResetOtp(payload).subscribe({
      next: () => {
        this.isVerifyingResetOtp = false;
        this.resetOtpVerified = true;
        clearInterval(this.resendInterval);
        this.otpResendSecs = 0;
      },
      error: (err: any) => {
        this.isVerifyingResetOtp = false;
        this.showToast(err.error?.message || 'Invalid or expired code.', 'danger');
      }
    });
  }

  /** True once new_password meets all requirements AND confirm_password matches it exactly. */
  get resetPwdMatch(): boolean {
    return this.resetData.new_password.length > 0 && this.resetData.new_password === this.resetData.confirm_password;
  }

  async confirmReset() {
    if (!this.resetOtpVerified) { this.showToast('Please verify the OTP code first.', 'warning'); return; }
    if (!this.resetData.new_password) { this.showToast('Please enter a new password.', 'warning'); return; }
    if (!this.resetPwdLength || !this.resetPwdUpper || !this.resetPwdLower || !this.resetPwdNum || !this.resetPwdSym) {
      this.showToast('Password does not meet all requirements.', 'warning'); return;
    }
    if (!this.resetData.confirm_password) { this.showToast('Please confirm your new password.', 'warning'); return; }
    if (this.resetData.new_password !== this.resetData.confirm_password) {
      this.showToast('Passwords do not match.', 'warning'); return;
    }

    const confirmed = await this.dialog.confirm({
      title: 'Reset Password',
      message: 'You are about to set a new password for this account. You will need to log in again with it afterward.',
      icon: 'lock-open', iconColor: 'var(--ion-color-danger)',
      confirmLabel: 'Reset Password', confirmColor: 'var(--ion-color-danger)',
    });
    if (!confirmed) return;

    const payload = this.otpChannel === 'email'
      ? { email: this.resetData.email, new_password: this.resetData.new_password, otp_channel: 'email' }
      : { phone: this.resetData.phone, new_password: this.resetData.new_password, otp_channel: 'phone' };
    this.isResettingPwd = true;
    this.api.resetPassword(payload).subscribe({
      next: () => {
        this.isResettingPwd = false;
        this.showToast('Password reset! You can now log in.', 'success');
        this.viewMode = 'login';
        this.resetData = { email: '', phone: '', otp: '', new_password: '', confirm_password: '' };
        this.otpChannel = null;
        this.resetOtpSent = false;
        this.resetOtpVerified = false;
        this.otpResendSecs = 0;
        clearInterval(this.resendInterval);
        this.onResetPasswordInput();
      },
      error: (err: any) => {
        this.isResettingPwd = false;
        // A 403 here means the 5-minute verified window (set by
        // verifyResetOtp) lapsed before Confirm was pressed — send them
        // back to re-verify rather than showing a generic error.
        if (err.status === 403) {
          this.resetOtpVerified = false;
          this.resetData.otp = '';
        }
        this.showToast(err.error?.message || 'Failed to reset password.', 'danger');
      }
    });
  }

  showToast(msg: string, color = 'danger') {
    this.toastMessage = msg; this.toastColor = color; this.toastOpen = false;
    setTimeout(() => { this.toastOpen = true; }, 10);
  }
}
