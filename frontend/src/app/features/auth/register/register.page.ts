import { Component, ViewChild } from '@angular/core';
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
    RegisterIdCaptureComponent, RegisterAccountDetailsComponent
  ],
})
export class RegisterPage {

  currentStep = 1;
  otpCode = '';
  isRegistering   = false;
  isVerifyingOtp  = false;

  @ViewChild(RegisterAccountDetailsComponent) accountDetailsCmp?: RegisterAccountDetailsComponent;

  userData = {
    first_name: '', last_name: '', phone: '', birthdate: '', username: '',
    email: '', password: '', confirm_password: '', barangay_id: null as number | null,
    valid_id_image: '',
    valid_id_type: '',
    selfie_with_id_image: '',
    otp_channel: 'email' as 'email' | 'sms'
  };

  constructor(
    private router: Router,
    private api: ApiService,
    private toastController: ToastController,
  ) {}

  nextStep(): void {
    if (this.currentStep === 1) {
      if (!this.userData.first_name?.trim() || !this.userData.last_name?.trim()
          || !this.userData.phone?.trim() || !this.userData.birthdate?.trim()) {
        this.showToast('Please fill out all personal details.'); return;
      }
      if (!this.userData.valid_id_type) { this.showToast('Please select your ID type.'); return; }
      if (!this.userData.valid_id_image) { this.showToast('A valid ID photo is required.'); return; }
      if (!this.userData.selfie_with_id_image) { this.showToast('A selfie holding your ID is required.'); return; }
    }
    if (this.currentStep === 2) {
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
        this.currentStep = 3;
      },
      error: (err: any) => { this.isRegistering = false; this.showToast(err?.error?.message ?? 'Registration failed.'); }
    });
  }

  verifyOtp(): void {
    if (!this.otpCode?.trim()) { this.showToast('Please enter the verification code.'); return; }
    if (this.isVerifyingOtp) return;
    this.isVerifyingOtp = true;
    this.api.verifyOtp({ email: this.userData.email, otp: this.otpCode }).subscribe({
      next: () => {
        this.isVerifyingOtp = false;
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
