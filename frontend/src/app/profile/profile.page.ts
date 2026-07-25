import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons,
  IonContent, IonButton, IonList, IonListHeader,
  IonLabel, IonItem, IonCard, IonCardContent,
  IonSelect, IonSelectOption, IonInput,
  IonModal, IonToast, AlertController,
} from '@ionic/angular/standalone';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { Router } from '@angular/router';
import { ApiService } from '../services/api';
import { OtpAutofillService } from '../services/otp-autofill';
import { UserSettingsService } from '../services/user-settings';
import { LocationService } from '../services/location';
import { ImageCacheService } from '../services/image-cache';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons,
    IonContent, IonButton, IonList, IonListHeader,
    IonLabel, IonItem, IonCard, IonCardContent,
    IonSelect, IonSelectOption, IonInput,
    IonModal, IonToast,
    ImageCropperComponent
  ]
})
export class ProfilePage implements OnInit, OnDestroy {

  userData: any = {};
  calculatedAge: string | number = 'N/A';
  resolvedAvatarUrl = '';

  pwdStep: 'idle' | 'choose-channel' | 'enter-otp' | 'change-password' = 'idle';
  pwdChannel: 'email' | 'phone' | null = null;
  pwdOtp = '';
  pwdSending = false;
  pwdVerifying = false;
  pwdFocused = false;
  passwords = { new: '', confirm: '' };

  checkLength(): boolean { return this.passwords.new?.length >= 8; }
  checkUpper(): boolean  { return /[A-Z]/.test(this.passwords.new); }
  checkLower(): boolean  { return /[a-z]/.test(this.passwords.new); }
  checkNum(): boolean    { return /\d/.test(this.passwords.new); }
  checkSym(): boolean    { return /[@$!%*#?&]/.test(this.passwords.new); }
  get passwordMeetsAllRules(): boolean {
    return this.checkLength() && this.checkUpper() && this.checkLower() && this.checkNum() && this.checkSym();
  }
  get passwordsMatch(): boolean {
    return this.passwords.new.length > 0 && this.passwords.new === this.passwords.confirm;
  }

  medicalData = { blood_type: '', allergies: '', medical_conditions: '', pwd_status: '' };

  toastOpen    = false;
  toastMessage = '';
  toastColor   = 'success';

  showCropper  = false;
  cropperFile: File | null = null;
  croppedBase64 = '';

  barangays = [
    { id: 1, name: 'Alua' },       { id: 2, name: 'Calaba' },
    { id: 3, name: 'Malapit' },    { id: 4, name: 'Mangga' },
    { id: 5, name: 'Poblacion' },  { id: 6, name: 'Pulo' },
    { id: 7, name: 'San Roque' },  { id: 8, name: 'Santo Cristo' },
    { id: 9, name: 'Tabon' }
  ];

  get barangayName(): string {
    return this.barangays.find(b => b.id === this.userData.barangay_id)?.name
        || `Barangay #${this.userData.barangay_id}`;
  }

  maskEmail(email: string): string {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    if (local.length <= 2) return local[0] + '*'.repeat(Math.max(local.length - 1, 1)) + '@' + domain;
    return local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] + '@' + domain;
  }

  maskPhone(phone: string): string {
    if (!phone || phone.length < 5) return phone;
    return phone.slice(0, 3) + '*'.repeat(phone.length - 4) + phone.slice(-1);
  }

  /** Helper: always get user_id reliably, falling back to localStorage. */
  private getUserId(): number | null {
    const id = this.userData?.user_id;
    if (id) return id;
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored)?.user_id ?? null : null;
  }

  constructor(
    private api: ApiService,
    private alertCtrl: AlertController,
    private otpAutofill: OtpAutofillService,
    private router: Router,
    private settings: UserSettingsService,
    private locationSvc: LocationService,
    private imageCache: ImageCacheService,
  ) {}

  private storageListener = () => this.loadLocalUser();

  async ngOnInit() {
    await this.loadLocalUser();
    // Re-sync whenever another page updates localStorage (e.g. after profile
    // picture update fires window.dispatchEvent(new Event('storage'))).
    window.addEventListener('storage', this.storageListener);
  }

  ngOnDestroy() {
    this.otpAutofill.stop();
    window.removeEventListener('storage', this.storageListener);
  }

  async loadLocalUser() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    try {
      this.userData = JSON.parse(userStr);
    } catch {
      localStorage.removeItem('user');
      return;
    }
    // Guard: if the parsed object has no user_id the cache is stale/corrupt.
    if (!this.userData?.user_id) {
      this.userData = {};
      return;
    }
    if (this.userData.birthdate) this.calculateAge(this.userData.birthdate);
    // Medical data — read from localStorage (which is kept in sync after
    // every save/update-profile-picture response via res.user).
    this.medicalData = {
      blood_type:         this.userData.blood_type         || '',
      allergies:          this.userData.allergies          || '',
      medical_conditions: this.userData.medical_conditions || '',
      pwd_status:         this.userData.pwd_status         || '',
    };
    // Resolve avatar via proxy so CORS is never an issue.
    const path = this.userData.profile_picture;
    if (!path) { this.resolvedAvatarUrl = ''; return; }
    const cached = this.imageCache.getCached(path);
    if (cached) {
      this.resolvedAvatarUrl = cached;
    } else {
      this.resolvedAvatarUrl = '';
      this.imageCache.resolve(path).then(url => { this.resolvedAvatarUrl = url; });
    }
  }

  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Logout',
      message: 'Are you sure you want to log out?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Logout', role: 'confirm', cssClass: 'alert-button-danger',
          handler: () => {
            this.api.logout().subscribe({ error: () => {} });
            this.locationSvc.stop();
            this.api.clearToken();
            this.imageCache.clear();
            this.settings.clear();
            localStorage.removeItem('user');
            localStorage.removeItem('role');
            document.documentElement.classList.remove('ion-palette-dark');
            this.router.navigate(['/login']);
          }
        }
      ]
    });
    await alert.present();
  }

  async triggerPhotoPicker() {
    const a = await this.alertCtrl.create({
      header: 'Change Profile Photo',
      buttons: [
        { text: 'Choose from Gallery', handler: () => { document.getElementById('profileGalleryInput')?.click(); } },
        { text: 'Take a Photo',        handler: () => { document.getElementById('profileCameraInput')?.click(); } },
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    await a.present();
  }

  onPhotoFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      this.showToast('Only photos are accepted (no GIFs or videos).', 'warning'); return;
    }
    if (file.size > 10 * 1024 * 1024) { this.showToast('Image too large. Max 10MB.', 'warning'); return; }
    this.cropperFile   = file;
    this.croppedBase64 = '';
    this.showCropper   = true;
    (event.target as HTMLInputElement).value = '';
  }

  onPhotoCropped(event: ImageCroppedEvent) {
    if (event.base64 && event.base64.length > 100) {
      this.croppedBase64 = event.base64;
    }
  }

  async confirmCrop() {
    if (!this.croppedBase64 || this.croppedBase64.length < 100) {
      this.showToast('Please wait for the image to load, then try again.', 'warning'); return;
    }
    const userId = this.getUserId();
    if (!userId) {
      this.showToast('Session data missing. Please log out and log back in.', 'danger'); return;
    }
    this.showCropper = false;
    const imagePayload = this.croppedBase64.startsWith('data:')
      ? this.croppedBase64
      : `data:image/jpeg;base64,${this.croppedBase64}`;
    this.api.updateProfilePicture({ user_id: userId, image: imagePayload }).subscribe({
      next: async (res: any) => {
        this.userData = res.user;
        localStorage.setItem('user', JSON.stringify(res.user));
        this.imageCache.clear();
        this.resolvedAvatarUrl = await this.imageCache.resolve(res.user.profile_picture);
        window.dispatchEvent(new Event('storage'));
        this.showToast('Profile picture updated!', 'success');
      },
      error: (err: any) => {
        this.showToast(err?.error?.message || 'Failed to update photo. Please try again.', 'danger');
      }
    });
    this.cropperFile   = null;
    this.croppedBase64 = '';
  }

  cancelCrop() { this.showCropper = false; this.cropperFile = null; this.croppedBase64 = ''; }

  saveMedicalProfile() {
    const userId = this.getUserId();
    if (!userId) {
      this.showToast('Session data missing. Please log out and log back in.', 'danger'); return;
    }
    this.api.updateMedicalProfile({ user_id: userId, ...this.medicalData }).subscribe({
      next: (res: any) => {
        // Keep full user object in sync — includes all medical fields.
        this.userData = res.user;
        localStorage.setItem('user', JSON.stringify(res.user));
        // Re-read medical fields from the server response.
        this.medicalData = {
          blood_type:         res.user.blood_type         || '',
          allergies:          res.user.allergies          || '',
          medical_conditions: res.user.medical_conditions || '',
          pwd_status:         res.user.pwd_status         || '',
        };
        this.showToast('Medical profile saved!', 'success');
      },
      error: () => this.showToast('Failed to save.', 'danger')
    });
  }

  startPasswordChange() {
    this.pwdStep = 'choose-channel'; this.pwdOtp = ''; this.passwords = { new: '', confirm: '' };
  }
  cancelPasswordChange() {
    this.otpAutofill.stop();
    this.pwdStep = 'idle'; this.pwdChannel = null; this.pwdOtp = ''; this.passwords = { new: '', confirm: '' };
  }

  sendPwdChangeOtp(channel: 'email' | 'phone') {
    this.pwdChannel = channel;
    this.pwdSending = true;
    this.api.sendPasswordChangeOtp({ user_id: this.getUserId(), channel }).subscribe({
      next: () => {
        this.pwdSending = false;
        this.pwdStep = 'enter-otp';
        this.showToast('Verification code sent.', 'success');
        this.otpAutofill.listen(code => { this.pwdOtp = code; this.verifyPwdChangeOtp(); });
      },
      error: () => { this.pwdSending = false; this.showToast('Failed to send code. Try again.', 'danger'); }
    });
  }

  onPwdOtpInput() {
    if (this.pwdOtp && this.pwdOtp.length === 4) this.verifyPwdChangeOtp();
  }

  verifyPwdChangeOtp() {
    if (!this.pwdOtp || this.pwdOtp.length < 4 || this.pwdVerifying) return;
    this.pwdVerifying = true;
    this.api.verifyPasswordChangeOtp({ user_id: this.getUserId(), otp: this.pwdOtp }).subscribe({
      next: () => { this.pwdVerifying = false; this.pwdStep = 'change-password'; this.otpAutofill.stop(); },
      error: () => { this.pwdVerifying = false; this.showToast('Invalid or expired code. Try again.', 'danger'); }
    });
  }

  async updatePassword() {
    if (!this.passwordMeetsAllRules) { this.showToast('New password does not meet all requirements.', 'danger'); return; }
    if (!this.passwordsMatch)        { this.showToast('Passwords do not match.', 'danger'); return; }
    const alert = await this.alertCtrl.create({
      header: 'Confirm Password Change', message: 'Are you sure you want to change your password?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Confirm', role: 'confirm', handler: () => {
          this.api.updatePassword({ user_id: this.getUserId(), new_password: this.passwords.new, otp_verified: true }).subscribe({
            next: () => { this.showToast('Password updated!', 'success'); this.cancelPasswordChange(); },
            error: (err: any) => this.showToast(err.error?.message || 'Update failed.', 'danger')
          });
        }}
      ]
    });
    await alert.present();
  }

  calculateAge(birthdateStr: string) {
    const birth = new Date(birthdateStr), today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    this.calculatedAge = age;
  }

  showToast(msg: string, color = 'success') {
    this.toastMessage = msg; this.toastColor = color; this.toastOpen = false;
    setTimeout(() => { this.toastOpen = true; }, 10);
  }
}
