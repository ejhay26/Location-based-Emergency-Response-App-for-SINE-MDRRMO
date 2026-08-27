import { Component, ViewChild, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonContent, IonText, IonProgressBar, IonItem, IonInput,
  IonSelect, IonSelectOption, IonCheckbox, IonLabel,
  IonButton, ModalController
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api';
import { RegisterIdCaptureComponent } from './components/register-id-capture/register-id-capture.component';
import { RegisterAccountDetailsComponent } from './components/register-account-details/register-account-details.component';
import { OtpBoxInputComponent } from '../../../shared/components/otp-box-input/otp-box-input.component';
import { formatPhoneLocalPart, isValidPhonePH } from '../../../shared/utils/phone.util';
import { OtpAutofillService } from '../../../core/services/otp-autofill';
import { BARANGAYS } from '../../../shared/constants/barangays';
import { TermsModalComponent } from '../../../shared/components/terms-modal/terms-modal.component';
import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';

/**
 * Modern Restructured 4-Step Registration Flow:
 *   1. Personal Identity & Residence (Name, Phone, 3-part Birthdate, Barangay)
 *   2. Account Credentials & Security (Username with suggestions, Email, Password match)
 *   3. Identity Verification & Legal Consent (Valid ID Front/Back, Selfie, OTP Channel choice, Terms & Privacy Agreement)
 *   4. Final Verification Code (6-digit OTP entry, Resend Timer, Auto-submit)
 */
@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonText, IonProgressBar, IonItem, IonInput,
    IonSelect, IonSelectOption, IonCheckbox, IonLabel,
    IonButton,
    RegisterIdCaptureComponent, RegisterAccountDetailsComponent, OtpBoxInputComponent,
    AppIconComponent
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
  termsAccepted    = false;
  private otpResendTimer: ReturnType<typeof setInterval> | null = null;

  barangays = BARANGAYS;

  phoneLocal = '';
  birthMonth = '';
  birthDay = '';
  birthYear = '';

  months = [
    { value: '01', label: 'Jan' },
    { value: '02', label: 'Feb' },
    { value: '03', label: 'Mar' },
    { value: '04', label: 'Apr' },
    { value: '05', label: 'May' },
    { value: '06', label: 'Jun' },
    { value: '07', label: 'Jul' },
    { value: '08', label: 'Aug' },
    { value: '09', label: 'Sep' },
    { value: '10', label: 'Oct' },
    { value: '11', label: 'Nov' },
    { value: '12', label: 'Dec' },
  ];

  birthYears = Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - i));
  birthdateError = '';
  todayStr = new Date().toISOString().split('T')[0];

  expiryMonth = '';
  expiryDay = '';
  expiryYear = '';
  expiryYears = Array.from({ length: 16 }, (_, i) => String(new Date().getFullYear() + i)); // 2026 to 2041

  get daysInExpiryMonth(): number[] {
    const month = parseInt(this.expiryMonth, 10) || 1;
    const year = parseInt(this.expiryYear, 10) || new Date().getFullYear();
    const daysCount = new Date(year, month, 0).getDate();
    return Array.from({ length: daysCount }, (_, i) => i + 1);
  }

  updateExpiryDate(): void {
    if (this.expiryYear && this.expiryMonth && this.expiryDay) {
      const dayStr = String(this.expiryDay).padStart(2, '0');
      this.userData.valid_id_expiry = `${this.expiryYear}-${this.expiryMonth}-${dayStr}`;
    } else {
      this.userData.valid_id_expiry = '';
    }
  }

  onHeaderBack(): void {
    if (this.currentStep > 1) {
      this.prevStep();
    } else {
      this.router.navigate(['/login']);
    }
  }

  cancelRegistration(): void {
    this.router.navigate(['/login']);
  }

  get daysInSelectedMonth(): number[] {
    const month = parseInt(this.birthMonth, 10) || 1;
    const year = parseInt(this.birthYear, 10) || new Date().getFullYear();
    const daysCount = new Date(year, month, 0).getDate();
    return Array.from({ length: daysCount }, (_, i) => i + 1);
  }

  updateBirthdate(): void {
    if (this.birthYear && this.birthMonth && this.birthDay) {
      const dayStr = String(this.birthDay).padStart(2, '0');
      const selectedStr = `${this.birthYear}-${this.birthMonth}-${dayStr}`;
      const selected = new Date(`${this.birthYear}-${this.birthMonth}-${dayStr}T00:00:00`);
      const now = new Date();
      now.setHours(23, 59, 59, 999);

      if (selected > now) {
        this.birthdateError = 'Birthdate cannot be in the future.';
        this.userData.birthdate = '';
        return;
      }

      this.birthdateError = '';
      this.userData.birthdate = selectedStr;
    } else {
      this.birthdateError = '';
      this.userData.birthdate = '';
    }
  }

  onPhoneInput(raw: string | null | undefined): void {
    this.phoneLocal = formatPhoneLocalPart(raw ?? '');
    this.userData.phone = this.phoneLocal.length === 10 ? '63' + this.phoneLocal : '';
  }

  @ViewChild(RegisterAccountDetailsComponent) accountDetailsCmp?: RegisterAccountDetailsComponent;

  idProfession = '';

  userData = {
    first_name: '', last_name: '', phone: '', birthdate: '', username: '',
    email: '', password: '', confirm_password: '', barangay_id: null as number | null,
    valid_id_image: '',
    valid_id_image_back: '',
    valid_id_type: '',
    valid_id_number: '',
    valid_id_expiry: '',
    valid_id_details: null as any,
    selfie_with_id_image: '',
    otp_channel: 'email' as 'email' | 'sms'
  };

  onIdTypeChange(): void {
    this.userData.valid_id_number = '';
    this.userData.valid_id_expiry = '';
    this.userData.valid_id_details = null;
    this.idProfession = '';
    this.expiryMonth = '';
    this.expiryDay = '';
    this.expiryYear = '';
  }

  onPhilSysInput(val: string | null | undefined): void {
    const digits = (val ?? '').replace(/\D/g, '').slice(0, 16);
    const chunks = digits.match(/.{1,4}/g);
    this.userData.valid_id_number = chunks ? chunks.join('-') : '';
  }

  onDriverLicenseInput(val: string | null | undefined): void {
    let clean = (val ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length > 9) clean = clean.slice(0, 9);
    if (clean.length > 5) {
      this.userData.valid_id_number = `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5)}`;
    } else if (clean.length > 3) {
      this.userData.valid_id_number = `${clean.slice(0, 3)}-${clean.slice(3)}`;
    } else {
      this.userData.valid_id_number = clean;
    }
  }

  onUmidInput(val: string | null | undefined): void {
    const digits = (val ?? '').replace(/\D/g, '').slice(0, 12);
    if (digits.length > 11) {
      this.userData.valid_id_number = `${digits.slice(0, 4)}-${digits.slice(4, 11)}-${digits.slice(11)}`;
    } else if (digits.length > 4) {
      this.userData.valid_id_number = `${digits.slice(0, 4)}-${digits.slice(4)}`;
    } else {
      this.userData.valid_id_number = digits;
    }
  }

  onPrcNumberInput(val: string | null | undefined): void {
    this.userData.valid_id_number = (val ?? '').replace(/\D/g, '').slice(0, 7);
  }

  private modalCtrl = inject(ModalController);
  private otpAutofill = inject(OtpAutofillService);

  constructor(
    private router: Router,
    private api: ApiService,
    private toastController: ToastController,
  ) {}

  ngOnDestroy(): void {
    this.otpAutofill.stop();
    this.stopOtpCountdown();
  }

  selectOtpChannel(channel: 'email' | 'sms'): void {
    this.userData.otp_channel = channel;
  }

  async openTermsModal(tab: 'terms' | 'privacy', event?: MouseEvent): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    const modal = await this.modalCtrl.create({
      component: TermsModalComponent,
      componentProps: { activeTab: tab },
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.accepted) {
      this.termsAccepted = true;
    }
  }

  nextStep(): void {
    // ── STEP 1: Personal Details & Residence ──
    if (this.currentStep === 1) {
      if (!this.userData.first_name?.trim() || !this.userData.last_name?.trim()
          || !isValidPhonePH(this.userData.phone) || !this.userData.birthdate?.trim()
          || !this.userData.barangay_id) {
        this.showToast('Please fill out all personal and residence details.');
        return;
      }
      this.currentStep = 2;
      return;
    }

    // ── STEP 2: Account Credentials & Security ──
    if (this.currentStep === 2) {
      if (!this.userData.username?.trim() || !this.userData.email?.trim()) {
        this.showToast('Please enter both username and email.');
        return;
      }
      if (this.accountDetailsCmp?.usernameAvailable !== true) {
        this.showToast('Please choose an available username.');
        return;
      }
      if (this.accountDetailsCmp?.emailAvailable !== true) {
        this.showToast('Please enter a valid, available email address.');
        return;
      }
      if (!this.accountDetailsCmp?.isPasswordValid) {
        this.showToast('Password must meet all 5 security requirements.');
        return;
      }
      if (this.accountDetailsCmp?.passwordsMatch !== true) {
        this.showToast('Passwords do not match.');
        return;
      }
      this.currentStep = 3;
      return;
    }

    // ── STEP 3: Identity Verification ──
    if (this.currentStep === 3) {
      if (!this.userData.valid_id_type) {
        this.showToast('Please select a Philippine Government ID type.');
        return;
      }
      if (!this.userData.valid_id_number?.trim()) {
        this.showToast('Please enter your valid ID number.');
        return;
      }
      const typesWithExpiry = ["Driver's License", 'Philippine Passport', 'Postal ID', 'PRC License'];
      if (typesWithExpiry.includes(this.userData.valid_id_type) && !this.userData.valid_id_expiry) {
        this.showToast('Please select your ID expiration date.');
        return;
      }
      if (this.userData.valid_id_type === 'PRC License' && this.idProfession.trim()) {
        this.userData.valid_id_details = { profession: this.idProfession.trim() };
      }
      if (!this.userData.valid_id_image) {
        this.showToast('A photo of the front of your ID is required.');
        return;
      }
      if (!this.userData.valid_id_image_back) {
        this.showToast('A photo of the back of your ID is required.');
        return;
      }
      if (!this.userData.selfie_with_id_image) {
        this.showToast('A selfie holding your ID is required.');
        return;
      }

      this.submitRegistration();
      return;
    }
  }

  prevStep(): void {
    if (this.currentStep > 1 && this.currentStep <= 3) {
      this.currentStep--;
    }
  }

  submitRegistration(): void {
    if (this.isRegistering) return;
    this.isRegistering = true;
    this.api.register(this.userData).subscribe({
      next: () => {
        this.isRegistering = false;
        const isSms = this.userData.otp_channel === 'sms';
        const msg = isSms
          ? `Verification code sent to your phone (${this.userData.phone}).`
          : `Verification code sent to ${this.userData.email}! Please check your inbox and spam/junk folder.`;
        this.showToast(msg, 'success');
        this.currentStep = 4;
        this.startOtpCountdown();
        if (isSms) {
          this.otpAutofill.listen(code => { this.otpCode = code; this.verifyOtp(); });
        }
      },
      error: (err: any) => {
        this.isRegistering = false;
        this.showToast(err?.error?.message ?? 'Registration failed. Please check your connection.');
      }
    });
  }

  private startOtpCountdown(): void {
    this.stopOtpCountdown();
    this.otpResendSecs = 60;
    this.otpResendTimer = setInterval(() => {
      this.otpResendSecs--;
      if (this.otpResendSecs <= 0) this.stopOtpCountdown();
    }, 1000);
  }

  private stopOtpCountdown(): void {
    if (this.otpResendTimer) {
      clearInterval(this.otpResendTimer);
      this.otpResendTimer = null;
    }
    this.otpResendSecs = 0;
  }

  resendOtp(): void {
    if (this.isResendingOtp || this.otpResendSecs > 0) return;
    this.isResendingOtp = true;
    this.api.resendRegistrationOtp({
      email: this.userData.email,
      otp_channel: this.userData.otp_channel,
      phone: this.userData.phone
    }).subscribe({
      next: () => {
        this.isResendingOtp = false;
        const isSms = this.userData.otp_channel === 'sms';
        const msg = isSms
          ? 'A new code was sent to your phone.'
          : 'A new code was sent! Please check your inbox and spam/junk folder.';
        this.showToast(msg, 'success');
        this.startOtpCountdown();
      },
      error: (err: any) => {
        this.isResendingOtp = false;
        this.showToast(err?.error?.message ?? 'Failed to resend code.');
      }
    });
  }

  verifyOtp(): void {
    if (!this.otpCode?.trim() || this.otpCode.length < 6) {
      this.showToast('Please enter the 6-digit verification code.');
      return;
    }
    if (!this.termsAccepted) {
      this.showToast('Please accept the Terms of Service and Privacy Policy to complete registration.');
      return;
    }
    if (this.isVerifyingOtp) return;
    this.isVerifyingOtp = true;
    this.api.verifyOtp({ email: this.userData.email, otp: this.otpCode }).subscribe({
      next: () => {
        this.isVerifyingOtp = false;
        this.otpAutofill.stop();
        this.stopOtpCountdown();
        this.router.navigate(['/pending-verification'], { queryParams: { login: this.userData.email } });
      },
      error: () => {
        this.isVerifyingOtp = false;
        this.showToast('Invalid verification code. Please check and try again.');
      }
    });
  }

  async showToast(msg: string, color = 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message: msg,
      duration: 3500,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}
