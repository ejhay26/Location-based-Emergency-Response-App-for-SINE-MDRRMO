import { Component, ViewChild, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonContent, IonText, IonProgressBar, IonList, IonItem, IonInput,
  IonSelect, IonSelectOption,
  IonButton
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api';
import { RegisterIdCaptureComponent } from './components/register-id-capture/register-id-capture.component';
import { RegisterAccountDetailsComponent } from './components/register-account-details/register-account-details.component';
import { OtpBoxInputComponent } from '../../../shared/components/otp-box-input/otp-box-input.component';
import { formatPhoneLocalPart, isValidPhonePH } from '../../../shared/utils/phone.util';
import { OtpAutofillService } from '../../../core/services/otp-autofill';

/**
 * Registration is a 4-step flow:
 *   1. Personal details (name, phone, birthdate)
 *   2. ID verification (type, front photo, back photo, selfie-with-ID)
 *   3. Account details (username/email/password + OTP channel choice)
 *   4. OTP verification
 * Steps 1 and 2 used to be merged into a single step 1 — split apart per
 * the redesign so ID capture reads as its own dedicated stage rather than
 * being buried under a wall of personal-info fields.
 */
@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonText, IonProgressBar, IonList, IonItem, IonInput,
    IonSelect, IonSelectOption,
    IonButton,
    RegisterIdCaptureComponent, RegisterAccountDetailsComponent, OtpBoxInputComponent
  ],
})
export class RegisterPage implements OnDestroy {

  readonly totalSteps = 4;
  currentStep = 1;
  otpCode = '';
  isRegistering    = false;
  isVerifyingOtp   = false;
  isResendingOtp   = false;
  otpResendSecs    = 0;
  private otpResendTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * The 10-digit local part only ("9171234567"), what the phone input
   * itself is bound to. `userData.phone` — what actually gets submitted —
   * is kept as the full "63XXXXXXXXXX" canonical value, built from this on
   * every keystroke via onPhoneInput(). Kept separate so a stray leading 0
   * a user types out of habit never has to round-trip through userData.phone.
   */
  phoneLocal = '';

  onPhoneInput(raw: string | null | undefined): void {
    this.phoneLocal = formatPhoneLocalPart(raw ?? '');
    this.userData.phone = this.phoneLocal.length === 10 ? '63' + this.phoneLocal : '';
  }

  @ViewChild(RegisterAccountDetailsComponent) accountDetailsCmp?: RegisterAccountDetailsComponent;

  userData = {
    first_name: '', last_name: '', phone: '', birthdate: '', username: '',
    email: '', password: '', confirm_password: '', barangay_id: null as number | null,
    valid_id_image: '',
    valid_id_image_back: '',
    valid_id_type: '',
    selfie_with_id_image: '',
    otp_channel: 'email' as 'email' | 'sms'
  };

  constructor(
    private router: Router,
    private api: ApiService,
    private toastController: ToastController,
  ) {}

  private otpAutofill = inject(OtpAutofillService);

  ngOnDestroy(): void {
    this.otpAutofill.stop();
    this.stopOtpCountdown();
  }

  nextStep(): void {
    if (this.currentStep === 1) {
      if (!this.userData.first_name?.trim() || !this.userData.last_name?.trim()
          || !isValidPhonePH(this.userData.phone) || !this.userData.birthdate?.trim()) {
        this.showToast('Please fill out all personal details.'); return;
      }
    }
    if (this.currentStep === 2) {
      if (!this.userData.valid_id_type) { this.showToast('Please select your ID type.'); return; }
      if (!this.userData.valid_id_image) { this.showToast('A photo of the front of your ID is required.'); return; }
      if (!this.userData.valid_id_image_back) { this.showToast('A photo of the back of your ID is required.'); return; }
      if (!this.userData.selfie_with_id_image) { this.showToast('A selfie holding your ID is required.'); return; }
    }
    if (this.currentStep === 3) {
      if (!this.userData.username?.trim() || !this.userData.email?.trim() || !this.userData.barangay_id) {
        this.showToast('Please fill out all account details.'); return;
      }
      if (this.accountDetailsCmp?.usernameAvailable !== true) { this.showToast('Please verify your username availability.'); return; }
      if (this.accountDetailsCmp?.emailAvailable !== true) { this.showToast('Please verify your email availability.'); return; }
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
      if (!passwordRegex.test(this.userData.password ?? '')) {
        this.showToast('Password must meet all security requirements.'); return;
      }
      if (this.userData.password !== this.userData.confirm_password) {
        this.showToast('Passwords do not match.'); return;
      }
      if (!this.accountDetailsCmp?.termsAccepted) { this.showToast('You must accept the Terms and Conditions.'); return; }
      this.submitRegistration();
      return;
    }
    this.currentStep++;
  }

  prevStep(): void { if (this.currentStep > 1) this.currentStep--; }

  submitRegistration(): void {
    if (this.isRegistering) return;
    this.isRegistering = true;
    this.api.register(this.userData).subscribe({
      next: () => {
        this.isRegistering = false;
        const channelLabel = this.userData.otp_channel === 'sms'
          ? `your phone number ${this.userData.phone}`
          : `your email ${this.userData.email}`;
        this.showToast(`Verification code sent to ${channelLabel}.`);
        this.currentStep = 4;
        this.startOtpCountdown();
        // Only meaningful on native Android — listen() silently no-ops
        // everywhere else (iOS, web, desktop), so it's harmless to always
        // call this rather than branch on platform.
        this.otpAutofill.listen(code => { this.otpCode = code; this.verifyOtp(); });
      },
      error: (err: any) => { this.isRegistering = false; this.showToast(err?.error?.message ?? 'Registration failed.'); }
    });
  }

  /** Starts (or restarts) the 60-second resend cooldown; mirrors the login-OTP page's existing pattern. */
  private startOtpCountdown(): void {
    this.stopOtpCountdown();
    this.otpResendSecs = 60;
    this.otpResendTimer = setInterval(() => {
      this.otpResendSecs--;
      if (this.otpResendSecs <= 0) this.stopOtpCountdown();
    }, 1000);
  }

  private stopOtpCountdown(): void {
    if (this.otpResendTimer) { clearInterval(this.otpResendTimer); this.otpResendTimer = null; }
    this.otpResendSecs = 0;
  }

  resendOtp(): void {
    if (this.isResendingOtp || this.otpResendSecs > 0) return;
    this.isResendingOtp = true;
    this.api.resendRegistrationOtp({ email: this.userData.email, otp_channel: this.userData.otp_channel, phone: this.userData.phone }).subscribe({
      next: () => {
        this.isResendingOtp = false;
        this.showToast('A new code was sent.', 'success');
        this.startOtpCountdown();
      },
      error: (err: any) => { this.isResendingOtp = false; this.showToast(err?.error?.message ?? 'Failed to resend code.'); }
    });
  }

  verifyOtp(): void {
    if (!this.otpCode?.trim() || this.otpCode.length < 4) { this.showToast('Please enter the 4-digit verification code.'); return; }
    if (this.isVerifyingOtp) return;
    this.isVerifyingOtp = true;
    this.api.verifyOtp({ email: this.userData.email, otp: this.otpCode }).subscribe({
      next: () => {
        this.isVerifyingOtp = false;
        this.otpAutofill.stop();
        this.stopOtpCountdown();
        // Account is verified but still `unverified` account_status — no
        // token comes back from this endpoint, so we don't touch
        // localStorage['user']/['role'] here (that's only ever set on a
        // real login). Medical profile info can be added later from the
        // real Profile page once the account is approved.
        this.router.navigate(['/pending-verification'], { queryParams: { login: this.userData.email } });
      },
      error: () => { this.isVerifyingOtp = false; this.showToast('Invalid verification code.'); }
    });
  }

  async showToast(msg: string, color = 'danger'): Promise<void> {
    const toast = await this.toastController.create({ message: msg, duration: 3000, position: 'bottom', color });
    await toast.present();
  }
}
