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
  termsAccepted = false;

  // Valid ID capture
  validIdPreview: string | null = null;
  rawIdImageFile: File | null = null;
  showIdCropper = false;

  // OTP channel selection
  otpChannel: 'email' | 'sms' = 'email';

  // Three-state availability: null = not checked yet, true = available, false = taken/invalid
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
    // Clean up debounce timers on component destroy
    if (this.usernameDebounceTimer) clearTimeout(this.usernameDebounceTimer);
    if (this.emailDebounceTimer) clearTimeout(this.emailDebounceTimer);
  }

  // ── PASSWORD VALIDATION GETTERS (always reactive) ────────────────────────────
  get pwdLength(): boolean { return (this.userData.password?.length ?? 0) >= 8; }
  get pwdUpper(): boolean { return /[A-Z]/.test(this.userData.password ?? ''); }
  get pwdLower(): boolean { return /[a-z]/.test(this.userData.password ?? ''); }
  get pwdNum(): boolean { return /\d/.test(this.userData.password ?? ''); }
  get pwdSym(): boolean { return /[@$!%*#?&]/.test(this.userData.password ?? ''); }

  // ── FORMAT VALIDATION (instant feedback) ──────────────────────────────────────
  isUsernameFormatValid(): boolean {
    // Only letters, numbers, underscores, and dots
    return /^[a-zA-Z0-9._]*$/.test(this.userData.username ?? '');
  }

  isEmailFormatValid(): boolean {
    // Basic email format validation
    return /^[^\s@]*@?[^\s@]*\.?[^\s@]*$/.test(this.userData.email ?? '');
  }

  // ── USERNAME AVAILABILITY CHECK ───────────────────────────────────────────────
  onUsernameInput(): void {
    const username = this.userData.username?.trim() ?? '';

    // Reset to neutral if field is empty
    if (!username) {
      this.usernameAvailable = null;
      this.usernameSuggestions = [];
      return;
    }

    // Check format instantly
    if (!this.isUsernameFormatValid()) {
      this.usernameAvailable = false;
      this.usernameSuggestions = [];
      return;
    }

    // Reset to neutral and clear suggestions while checking
    this.usernameAvailable = null;
    this.usernameSuggestions = [];

    // Clear previous timer
    if (this.usernameDebounceTimer) clearTimeout(this.usernameDebounceTimer);

    // Only check if username is at least 3 characters
    if (username.length < 3) return;

    // Debounce API call by 500ms
    this.usernameDebounceTimer = setTimeout(() => {
      this.api.checkUsername(username).subscribe({
        next: (res: any) => {
          if (res?.available) {
            this.usernameAvailable = true;
            this.usernameSuggestions = [];
          } else {
            this.usernameAvailable = false;
            this.generateUsernameSuggestions();
          }
        },
        error: (err) => {
          console.error('Username check error:', err);
          this.usernameAvailable = null;
        }
      });
    }, 500);
  }

  // ── EMAIL AVAILABILITY CHECK ──────────────────────────────────────────────────
  onEmailInput(): void {
    const email = this.userData.email?.trim() ?? '';

    // Reset to neutral if field is empty
    if (!email) {
      this.emailAvailable = null;
      return;
    }

    // Check format instantly
    if (!this.isEmailFormatValid()) {
      this.emailAvailable = false;
      return;
    }

    // Reset to neutral while checking
    this.emailAvailable = null;

    // Clear previous timer
    if (this.emailDebounceTimer) clearTimeout(this.emailDebounceTimer);

    // Debounce API call by 500ms
    this.emailDebounceTimer = setTimeout(() => {
      this.api.checkEmail(email).subscribe({
        next: (res: any) => {
          this.emailAvailable = res?.available ?? false;
        },
        error: (err) => {
          console.error('Email check error:', err);
          this.emailAvailable = null;
        }
      });
    }, 500);
  }

  // ── GENERATE USERNAME SUGGESTIONS ─────────────────────────────────────────────
  private generateUsernameSuggestions(): void {
    const firstName = this.userData.first_name?.toLowerCase().replace(/\s+/g, '') ?? 'user';
    const lastName = this.userData.last_name?.toLowerCase().substring(0, 2) ?? '';
    const birthYear = this.userData.birthdate 
      ? new Date(this.userData.birthdate).getFullYear().toString() 
      : '26';
    
    const base = firstName + lastName;
    
    this.usernameSuggestions = [
      `${base}_${birthYear}`,
      `${base}${Math.floor(10 + Math.random() * 90)}`,
      `sine_${base}`
    ].filter(s => s.length > 0); // Filter out empty suggestions
  }

  applySuggestion(name: string): void {
    this.userData.username = name;
    this.usernameAvailable = true;
    this.usernameSuggestions = [];
  }

  // ── ID CAPTURE using native file input ────────────────────────────────────────
  triggerIdCapture(): void {
    document.getElementById('idCaptureInput')?.click();
  }

  onIdFileSelected(event: any): void {
    const file: File = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    const maxSizeMb = 10;
    if (file.size > maxSizeMb * 1024 * 1024) {
      this.showToast(`File too large. Max ${maxSizeMb}MB.`);
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      this.showToast('Please select an image file.');
      return;
    }

    this.rawIdImageFile = file;
    this.showIdCropper = true;

    // Reset the input so the same file can be re-selected if needed
    (event.target as HTMLInputElement).value = '';
  }

  idCroppedBase64: string = '';

  get idCropperImageFile(): File | null {
    return this.rawIdImageFile;
  }

  onIdCropped(event: ImageCroppedEvent): void {
    this.idCroppedBase64 = event.base64 ?? '';
  }

  confirmIdCrop(): void {
    if (!this.idCroppedBase64) {
      this.showToast('Please wait for the image to load.');
      return;
    }
    this.validIdPreview = this.idCroppedBase64;
    this.userData.valid_id_image = this.idCroppedBase64;
    this.showIdCropper = false;
    this.rawIdImageFile = null;
  }

  cancelIdCrop(): void {
    this.showIdCropper = false;
    this.rawIdImageFile = null;
    this.idCroppedBase64 = '';
  }

  clearValidId(): void {
    this.validIdPreview = null;
    this.userData.valid_id_image = '';
  }

  // ── OTP CHANNEL SELECTION ─────────────────────────────────────────────────────
  selectOtpChannel(channel: 'email' | 'sms'): void {
    this.otpChannel = channel;
    this.userData.otp_channel = channel;
  }

  // ── STEP NAVIGATION ───────────────────────────────────────────────────────────
  nextStep(): void {
    if (this.currentStep === 1) {
      if (!this.userData.first_name?.trim() || !this.userData.last_name?.trim() 
          || !this.userData.phone?.trim() || !this.userData.birthdate?.trim()) {
        this.showToast('Please fill out all personal details.');
        return;
      }
      if (!this.validIdPreview) {
        this.showToast('A valid ID photo is required.');
        return;
      }
    }

    if (this.currentStep === 2) {
      if (!this.userData.username?.trim() || !this.userData.email?.trim() 
          || !this.userData.barangay_id) {
        this.showToast('Please fill out all account details.');
        return;
      }

      // Check availability statuses: must be exactly true (not null or false)
      if (this.usernameAvailable !== true) {
        this.showToast('Please verify your username availability.');
        return;
      }
      if (this.emailAvailable !== true) {
        this.showToast('Please verify your email availability.');
        return;
      }

      // Validate password meets all requirements
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
      if (!passwordRegex.test(this.userData.password ?? '')) {
        this.showToast('Password must meet all security requirements.');
        return;
      }

      // Check password confirmation
      if (this.userData.password !== this.userData.confirm_password) {
        this.showToast('Passwords do not match.');
        return;
      }

      // Check terms acceptance
      if (!this.termsAccepted) {
        this.showToast('You must accept the Terms and Conditions.');
        return;
      }

      // All validations passed, submit registration
      this.submitRegistration();
      return;
    }

    this.currentStep++;
  }

  prevStep(): void {
    if (this.currentStep > 1) this.currentStep--;
  }

  submitRegistration(): void {
    this.api.register(this.userData).subscribe({
      next: () => {
        const channelLabel = this.otpChannel === 'sms'
          ? `your phone number ${this.userData.phone}`
          : `your email ${this.userData.email}`;
        this.showToast(`Verification code sent to ${channelLabel}.`);
        this.currentStep = 3;
      },
      error: (err: any) => {
        this.showToast(err?.error?.message ?? 'Registration failed.');
      }
    });
  }

  // ── POST-REGISTRATION MEDICAL PROFILE PROMPT ──────────────────────────────────
  showMedicalModal = false;
  medicalData = { blood_type: '', allergies: '', medical_conditions: '', pwd_status: '' };
  isSavingMedical = false;

  verifyOtp(): void {
    if (!this.otpCode?.trim()) {
      this.showToast('Please enter the verification code.');
      return;
    }

    this.api.verifyOtp({ email: this.userData.email, otp: this.otpCode }).subscribe({
      next: (res: any) => {
        localStorage.setItem('user', JSON.stringify(res.user));
        localStorage.setItem('role', res.role);
        // Show optional medical profile prompt before going home
        this.showMedicalModal = true;
      },
      error: () => {
        this.showToast('Invalid verification code.');
      }
    });
  }

  saveMedicalAndProceed(): void {
    try {
      const user = JSON.parse(localStorage.getItem('user') ?? '{}');
      if (!user?.user_id) {
        this.showToast('Session error. Please try again.');
        return;
      }

      this.isSavingMedical = true;

      this.api.updateMedicalProfile({ user_id: user.user_id, ...this.medicalData }).subscribe({
        next: (res: any) => {
          this.isSavingMedical = false;
          localStorage.setItem('user', JSON.stringify(res.user));
          this.showMedicalModal = false;
          this.promptTourIfNew();
        },
        error: (err) => {
          this.isSavingMedical = false;
          console.error('Failed to save medical profile:', err);
          this.showToast('Failed to save. You can update this from your Profile later.');
          this.skipMedical();
        }
      });
    } catch (err) {
      console.error('Error parsing user data:', err);
      this.showToast('Session error. Please try again.');
    }
  }

  skipMedical(): void {
    this.showMedicalModal = false;
    this.promptTourIfNew();
  }

  private promptTourIfNew(): void {
    this.router.navigate(['/tabs/home']).then(() => {
      if (!this.tour.hasSeenTour()) {
        setTimeout(() => this.tour.promptStart(), 600);
      }
    });
  }

  async showToast(msg: string, color = 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message: msg,
      duration: 3000,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}