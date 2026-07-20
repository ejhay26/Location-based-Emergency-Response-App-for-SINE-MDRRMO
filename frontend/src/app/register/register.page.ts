import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonContent, IonText, IonProgressBar, IonList, IonItem, IonInput,
  IonInputPasswordToggle, IonLabel, IonCard, IonCardContent,
  IonSelect, IonSelectOption, IonChip, IonCheckbox,
  IonRow, IonCol, IonButton, IonModal
} from '@ionic/angular/standalone';
import { ImageCropperComponent, ImageCroppedEvent, LoadedImage } from 'ngx-image-cropper';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ApiService } from '../services/api';
import { TourService } from '../services/tour';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonText, IonProgressBar, IonList, IonItem, IonInput,
    IonInputPasswordToggle, IonLabel, IonCard, IonCardContent,
    IonSelect, IonSelectOption, IonChip, IonCheckbox,
    IonRow, IonCol, IonButton, IonModal, IonSelect, IonSelectOption,
    ImageCropperComponent
  ],
})
export class RegisterPage {

  currentStep = 1;
  otpCode = '';
  passwordFocused = false;
  termsAccepted = false;

  // Valid ID capture
  validIdPreview: string | null = null;
  rawIdImageFile: File | null = null;
  showIdCropper = false;

  // OTP channel selection
  otpChannel: 'email' | 'sms' = 'email';

  usernameStatus: 'idle' | 'checking' | 'available' | 'taken' = 'idle';
  emailStatus: 'idle' | 'checking' | 'available' | 'taken' = 'idle';
  usernameSuggestions: string[] = [];
  private debounceTimeout: any;

  barangays = [
    { id: 1, name: 'Alua' }, { id: 2, name: 'Calaba' }, { id: 3, name: 'Malapit' },
    { id: 4, name: 'Mangga' }, { id: 5, name: 'Poblacion' }, { id: 6, name: 'Pulo' },
    { id: 7, name: 'San Roque' }, { id: 8, name: 'Santo Cristo' }, { id: 9, name: 'Tabon' }
  ];

  userData = {
    first_name: '', last_name: '', phone: '', birthdate: '', username: '',
    email: '', password: '', confirm_password: '', barangay_id: null as number | null,
    valid_id_image: '',
    otp_channel: 'email' as 'email' | 'sms'
  };

  constructor(
    private router: Router,
    private api: ApiService,
    private toastController: ToastController,
    private sanitizer: DomSanitizer,
    private tour: TourService
  ) {}

  checkLength(): boolean { return this.userData.password?.length >= 8; }
  checkUpper(): boolean  { return /[A-Z]/.test(this.userData.password); }
  checkLower(): boolean  { return /[a-z]/.test(this.userData.password); }
  checkNum(): boolean    { return /\d/.test(this.userData.password); }
  checkSym(): boolean    { return /[@$!%*#?&]/.test(this.userData.password); }

  onUsernameChange() {
    if (!this.userData.username) { this.usernameStatus = 'idle'; return; }
    this.usernameStatus = 'checking';
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      this.api.checkUsername(this.userData.username).subscribe({
        next: (res: any) => {
          if (res.available) { this.usernameStatus = 'available'; this.usernameSuggestions = []; }
          else { this.usernameStatus = 'taken'; this.generateUsernameSuggestions(); }
        },
        error: () => { this.usernameStatus = 'idle'; }
      });
    }, 600);
  }

  onEmailChange() {
    if (!this.userData.email) { this.emailStatus = 'idle'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.userData.email)) { this.emailStatus = 'taken'; return; }
    this.emailStatus = 'checking';
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      this.api.checkEmail(this.userData.email).subscribe({
        next: (res: any) => { this.emailStatus = res.available ? 'available' : 'taken'; },
        error: () => { this.emailStatus = 'idle'; }
      });
    }, 600);
  }

  generateUsernameSuggestions() {
    const base = (this.userData.first_name || 'user').toLowerCase().replace(/\s+/g, '')
               + (this.userData.last_name || '').toLowerCase().substring(0, 2);
    const birthYear = this.userData.birthdate ? new Date(this.userData.birthdate).getFullYear() : '26';
    this.usernameSuggestions = [
      `${base}_${birthYear}`,
      `${base}${Math.floor(10 + Math.random() * 90)}`,
      `sine_${base}`
    ];
  }

  applySuggestion(name: string) {
    this.userData.username = name;
    this.usernameStatus = 'available';
    this.usernameSuggestions = [];
  }

  // ── ID Capture using native file input (non-deprecated) ─────────────────────
  triggerIdCapture() {
    document.getElementById('idCaptureInput')?.click();
  }

  onIdFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { this.showToast('File too large. Max 10MB.'); return; }
    this.rawIdImageFile = file;
    this.showIdCropper = true;
    // Reset the input so the same file can be re-selected if needed
    (event.target as HTMLInputElement).value = '';
  }

  idCropperImageChangedEvent: Event | null = null;
  idCroppedBase64: string = '';

  get idCropperImageFile(): File | null { return this.rawIdImageFile; }

  onIdCropped(event: ImageCroppedEvent) {
    this.idCroppedBase64 = event.base64 || '';
  }

  confirmIdCrop() {
    if (!this.idCroppedBase64) { this.showToast('Please wait for the image to load.'); return; }
    this.validIdPreview = this.idCroppedBase64;
    this.userData.valid_id_image = this.idCroppedBase64;
    this.showIdCropper = false;
    this.rawIdImageFile = null;
  }

  cancelIdCrop() {
    this.showIdCropper = false;
    this.rawIdImageFile = null;
    this.idCroppedBase64 = '';
  }

  clearValidId() {
    this.validIdPreview = null;
    this.userData.valid_id_image = '';
  }

  // ── OTP Channel Selection ───────────────────────────────────────────────────
  selectOtpChannel(channel: 'email' | 'sms') {
    this.otpChannel = channel;
    this.userData.otp_channel = channel;
  }

  // ── Step Navigation ─────────────────────────────────────────────────────────
  nextStep() {
    if (this.currentStep === 1) {
      if (!this.userData.first_name || !this.userData.last_name || !this.userData.phone || !this.userData.birthdate) {
        this.showToast('Please fill out all personal details.'); return;
      }
      if (!this.validIdPreview) { this.showToast('A valid ID photo is required.'); return; }
    }
    if (this.currentStep === 2) {
      if (!this.userData.username || !this.userData.email || !this.userData.barangay_id) {
        this.showToast('Please fill out all account details.'); return;
      }
      if (this.usernameStatus === 'taken' || this.emailStatus === 'taken') {
        this.showToast('Username or email is already taken.'); return;
      }
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
      if (!passwordRegex.test(this.userData.password)) {
        this.showToast('Password must meet all security requirements.'); return;
      }
      if (this.userData.password !== this.userData.confirm_password) {
        this.showToast('Passwords do not match.'); return;
      }
      if (!this.termsAccepted) { this.showToast('You must accept the Terms and Conditions.'); return; }
      // Step 2 goes to OTP channel selection (step 2.5, embedded in step 2 UI)
      // then submits registration
      this.submitRegistration(); return;
    }
    this.currentStep++;
  }

  prevStep() { if (this.currentStep > 1) this.currentStep--; }

  submitRegistration() {
    this.api.register(this.userData).subscribe({
      next: () => {
        const channelLabel = this.otpChannel === 'sms'
          ? `your phone number ${this.userData.phone}`
          : `your email ${this.userData.email}`;
        this.showToast(`Verification code sent to ${channelLabel}.`);
        this.currentStep = 3;
      },
      error: (err: any) => { this.showToast(err.error?.message || 'Registration failed.'); }
    });
  }

  // ── Post-registration medical profile prompt ────────────────────────
  showMedicalModal = false;
  medicalData = { blood_type: '', allergies: '', medical_conditions: '', pwd_status: '' };
  isSavingMedical = false;

  verifyOtp() {
    this.api.verifyOtp({ email: this.userData.email, otp: this.otpCode }).subscribe({
      next: (res: any) => {
        localStorage.setItem('user', JSON.stringify(res.user));
        localStorage.setItem('role', res.role);
        // Show the optional medical profile prompt before going home.
        // If the user skips, they can always fill it in from their profile page.
        this.showMedicalModal = true;
      },
      error: () => { this.showToast('Invalid verification code.'); }
    });
  }

  saveMedicalAndProceed() {
    const user = JSON.parse(localStorage.getItem('user')!);
    this.isSavingMedical = true;
    this.api.updateMedicalProfile({ user_id: user.user_id, ...this.medicalData }).subscribe({
      next: (res: any) => {
        localStorage.setItem('user', JSON.stringify(res.user));
        this.isSavingMedical = false;
        this.showMedicalModal = false;
        this.router.navigate(['/tabs/home']);
      },
      error: () => { this.isSavingMedical = false; this.showToast('Failed to save. You can update this from your Profile later.'); this.skipMedical(); }
    });
  }

  skipMedical() {
    this.showMedicalModal = false;
    this.promptTourIfNew();
  }

  private promptTourIfNew() {
    this.router.navigate(['/tabs/home']).then(() => {
      if (!this.tour.hasSeenTour()) {
        setTimeout(() => this.tour.promptStart(), 600);
      }
    });
  }

  async showToast(msg: string, color = 'danger') {
    const toast = await this.toastController.create({ message: msg, duration: 3000, position: 'bottom', color });
    await toast.present();
  }
}