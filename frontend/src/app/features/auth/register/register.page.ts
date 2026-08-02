import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonContent, IonText, IonProgressBar, IonList, IonItem, IonInput,
  IonInputPasswordToggle, IonCard, IonCardContent,
  IonSelect, IonSelectOption, IonChip, IonCheckbox,
  IonButton, IonModal
} from '@ionic/angular/standalone';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api';
import { TourService } from '../../../core/services/tour';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonText, IonProgressBar, IonList, IonItem, IonInput,
    IonInputPasswordToggle, IonCard, IonCardContent,
    IonSelect, IonSelectOption, IonChip, IonCheckbox,
    IonButton, IonModal,
    ImageCropperComponent
  ],
})
export class RegisterPage implements OnDestroy {

  currentStep = 1;
  otpCode = '';
  passwordFocused = false;
  termsAccepted   = false;
  isRegistering   = false;
  isVerifyingOtp  = false;
  isSavingMedical = false;
  showMedicalModal = false;

  validIdPreview: string | null = null;
  rawIdImageFile: File | null = null;
  showIdCropper = false;

  selfieWithIdPreview: string | null = null;
  rawSelfieImageFile: File | null = null;
  showSelfieCropper = false;

  otpChannel: 'email' | 'sms' = 'email';

  usernameAvailable: boolean | null = null;
  emailAvailable: boolean | null = null;
  usernameSuggestions: string[] = [];

  private usernameDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private emailDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  barangays = [
    { id: 1, name: 'Alua' }, { id: 2, name: 'Calaba' }, { id: 3, name: 'Malapit' },
    { id: 4, name: 'Mangga' }, { id: 5, name: 'Poblacion' }, { id: 6, name: 'Pulo' },
    { id: 7, name: 'San Roque' }, { id: 8, name: 'Santo Cristo' }, { id: 9, name: 'Tabon' }
  ];

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
    private sanitizer: DomSanitizer,
    private tour: TourService
  ) {}

  ngOnDestroy(): void {
    if (this.usernameDebounceTimer) clearTimeout(this.usernameDebounceTimer);
    if (this.emailDebounceTimer) clearTimeout(this.emailDebounceTimer);
  }

  get pwdLength(): boolean { return (this.userData.password?.length ?? 0) >= 8; }
  get pwdUpper(): boolean { return /[A-Z]/.test(this.userData.password ?? ''); }
  get pwdLower(): boolean { return /[a-z]/.test(this.userData.password ?? ''); }
  get pwdNum(): boolean { return /\d/.test(this.userData.password ?? ''); }
  get pwdSym(): boolean { return /[@$!%*#?&]/.test(this.userData.password ?? ''); }

  isUsernameFormatValid(): boolean {
    return /^[a-zA-Z0-9._]*$/.test(this.userData.username ?? '');
  }

  isEmailFormatValid(): boolean {
    return /^[^\s@]*@?[^\s@]*\.?[^\s@]*$/.test(this.userData.email ?? '');
  }

  onUsernameInput(): void {
    const username = this.userData.username?.trim() ?? '';
    if (!username) { this.usernameAvailable = null; this.usernameSuggestions = []; return; }
    if (!this.isUsernameFormatValid()) { this.usernameAvailable = false; this.usernameSuggestions = []; return; }
    this.usernameAvailable = null;
    this.usernameSuggestions = [];
    if (this.usernameDebounceTimer) clearTimeout(this.usernameDebounceTimer);
    if (username.length < 3) return;
    this.usernameDebounceTimer = setTimeout(() => {
      this.api.checkUsername(username).subscribe({
        next: (res: any) => {
          if (res?.available) { this.usernameAvailable = true; this.usernameSuggestions = []; }
          else { this.usernameAvailable = false; this.generateUsernameSuggestions(); }
        },
        error: () => { this.usernameAvailable = null; }
      });
    }, 500);
  }

  onEmailInput(): void {
    const email = this.userData.email?.trim() ?? '';
    if (!email) { this.emailAvailable = null; return; }
    if (!this.isEmailFormatValid()) { this.emailAvailable = false; return; }
    this.emailAvailable = null;
    if (this.emailDebounceTimer) clearTimeout(this.emailDebounceTimer);
    this.emailDebounceTimer = setTimeout(() => {
      this.api.checkEmail(email).subscribe({
        next: (res: any) => { this.emailAvailable = res?.available ?? false; },
        error: () => { this.emailAvailable = null; }
      });
    }, 500);
  }

  private generateUsernameSuggestions(): void {
    const firstName = this.userData.first_name?.toLowerCase().replace(/\s+/g, '') ?? 'user';
    const lastName = this.userData.last_name?.toLowerCase().substring(0, 2) ?? '';
    const birthYear = this.userData.birthdate
      ? new Date(this.userData.birthdate).getFullYear().toString() : '26';
    const base = firstName + lastName;
    this.usernameSuggestions = [
      `${base}_${birthYear}`,
      `${base}${Math.floor(10 + Math.random() * 90)}`,
      `sine_${base}`
    ].filter(s => s.length > 0);
  }

  applySuggestion(name: string): void {
    this.userData.username = name;
    this.usernameAvailable = true;
    this.usernameSuggestions = [];
  }

  async triggerIdCapture(): Promise<void> {
    try {
      await Camera.requestPermissions({ permissions: ['camera'] });
      const result = await Camera.getPhoto({ quality: 80, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Camera });
      if (!result.dataUrl) return;
      const res = await fetch(result.dataUrl);
      const blob = await res.blob();
      this.rawIdImageFile = new File([blob], 'id_capture.jpg', { type: 'image/jpeg' });
      this.showIdCropper = true;
    } catch { /* cancelled */ }
  }

  idCroppedBase64: string = '';

  get idCropperImageFile(): File | null { return this.rawIdImageFile; }

  onIdCropped(event: ImageCroppedEvent): void { this.idCroppedBase64 = event.base64 ?? ''; }

  confirmIdCrop(): void {
    if (!this.idCroppedBase64) { this.showToast('Please wait for the image to load.'); return; }
    this.validIdPreview = this.idCroppedBase64;
    this.userData.valid_id_image = this.idCroppedBase64;
    this.showIdCropper = false;
    this.rawIdImageFile = null;
  }

  cancelIdCrop(): void { this.showIdCropper = false; this.rawIdImageFile = null; this.idCroppedBase64 = ''; }

  clearValidId(): void { this.validIdPreview = null; this.userData.valid_id_image = ''; }

  async triggerSelfieCapture(): Promise<void> {
    try {
      await Camera.requestPermissions({ permissions: ['camera'] });
      const result = await Camera.getPhoto({ quality: 80, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Camera, direction: CameraDirection.Front });
      if (!result.dataUrl) return;
      const res = await fetch(result.dataUrl);
      const blob = await res.blob();
      this.rawSelfieImageFile = new File([blob], 'selfie_capture.jpg', { type: 'image/jpeg' });
      this.showSelfieCropper = true;
    } catch { /* cancelled */ }
  }

  selfieCroppedBase64: string = '';

  get selfieCropperImageFile(): File | null { return this.rawSelfieImageFile; }

  onSelfieCropped(event: ImageCroppedEvent): void { this.selfieCroppedBase64 = event.base64 ?? ''; }

  confirmSelfieCrop(): void {
    if (!this.selfieCroppedBase64) { this.showToast('Please wait for the image to load.'); return; }
    this.selfieWithIdPreview = this.selfieCroppedBase64;
    this.userData.selfie_with_id_image = this.selfieCroppedBase64;
    this.showSelfieCropper = false;
    this.rawSelfieImageFile = null;
  }

  cancelSelfieCrop(): void { this.showSelfieCropper = false; this.rawSelfieImageFile = null; this.selfieCroppedBase64 = ''; }

  clearSelfieWithId(): void { this.selfieWithIdPreview = null; this.userData.selfie_with_id_image = ''; }

  selectOtpChannel(channel: 'email' | 'sms'): void {
    this.otpChannel = channel;
    this.userData.otp_channel = channel;
  }

  nextStep(): void {
    if (this.currentStep === 1) {
      if (!this.userData.first_name?.trim() || !this.userData.last_name?.trim()
          || !this.userData.phone?.trim() || !this.userData.birthdate?.trim()) {
        this.showToast('Please fill out all personal details.'); return;
      }
      if (!this.userData.valid_id_type) { this.showToast('Please select your ID type.'); return; }
      if (!this.validIdPreview) { this.showToast('A valid ID photo is required.'); return; }
      if (!this.selfieWithIdPreview) { this.showToast('A selfie holding your ID is required.'); return; }
    }
    if (this.currentStep === 2) {
      if (!this.userData.username?.trim() || !this.userData.email?.trim() || !this.userData.barangay_id) {
        this.showToast('Please fill out all account details.'); return;
      }
      if (this.usernameAvailable !== true) { this.showToast('Please verify your username availability.'); return; }
      if (this.emailAvailable !== true) { this.showToast('Please verify your email availability.'); return; }
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
      if (!passwordRegex.test(this.userData.password ?? '')) {
        this.showToast('Password must meet all security requirements.'); return;
      }
      if (this.userData.password !== this.userData.confirm_password) {
        this.showToast('Passwords do not match.'); return;
      }
      if (!this.termsAccepted) { this.showToast('You must accept the Terms and Conditions.'); return; }
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
        const channelLabel = this.otpChannel === 'sms'
          ? `your phone number ${this.userData.phone}`
          : `your email ${this.userData.email}`;
        this.showToast(`Verification code sent to ${channelLabel}.`);
        this.currentStep = 3;
      },
      error: (err: any) => { this.isRegistering = false; this.showToast(err?.error?.message ?? 'Registration failed.'); }
    });
  }

  medicalData = { blood_type: '', allergies: '', medical_conditions: '', pwd_status: '' };

  verifyOtp(): void {
    if (!this.otpCode?.trim()) { this.showToast('Please enter the verification code.'); return; }
    if (this.isVerifyingOtp) return;
    this.isVerifyingOtp = true;
    this.api.verifyOtp({ email: this.userData.email, otp: this.otpCode }).subscribe({
      next: (res: any) => {
        this.isVerifyingOtp = false;
        localStorage.setItem('user', JSON.stringify(res.user));
        localStorage.setItem('role', res.role);
        this.showMedicalModal = true;
      },
      error: () => { this.isVerifyingOtp = false; this.showToast('Invalid verification code.'); }
    });
  }

  saveMedicalAndProceed(): void {
    const user = (() => { try { return JSON.parse(localStorage.getItem('user') ?? '{}'); } catch { return {}; } })();
    if (!user?.user_id) { this.showToast('Session error. Please try again.'); return; }
    this.isSavingMedical = true;
    this.api.updateMedicalProfile({ user_id: user.user_id, ...this.medicalData }).subscribe({
      next: (res: any) => {
        this.isSavingMedical = false;
        localStorage.setItem('user', JSON.stringify(res.user));
        this.showMedicalModal = false;
        this.promptTourIfNew();
      },
      error: () => {
        this.isSavingMedical = false;
        this.showToast('Failed to save. You can update this from your Profile later.');
        this.skipMedical();
      }
    });
  }

  skipMedical(): void { this.showMedicalModal = false; this.promptTourIfNew(); }

  private promptTourIfNew(): void {
    this.router.navigate(['/tabs/home']).then(() => {
      if (!this.tour.hasSeenTour()) setTimeout(() => this.tour.promptStart(), 600);
    });
  }

  async showToast(msg: string, color = 'danger'): Promise<void> {
    const toast = await this.toastController.create({ message: msg, duration: 3000, position: 'bottom', color });
    await toast.present();
  }
}
