import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class RegisterPage {

  currentStep = 1;
  otpCode = '';
  passwordFocused = false;
  termsAccepted = false;
  validIdPreview: string | null = null;

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
    email: '', password: '', confirm_password: '', barangay_id: null,
    valid_id_image: ''
  };

  constructor(
    private router: Router,
    private api: ApiService,
    private toastController: ToastController
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

  async captureValidId() {
    try {
      const image = await Camera.getPhoto({ quality: 80, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Camera });
      this.validIdPreview = image.dataUrl || null;
      this.userData.valid_id_image = this.validIdPreview || '';
    } catch (e) { this.showToast('Camera closed.'); }
  }

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
      this.submitRegistration(); return;
    }
    this.currentStep++;
  }

  prevStep() { if (this.currentStep > 1) this.currentStep--; }

  submitRegistration() {
    this.api.register(this.userData).subscribe({
      next: () => { this.showToast('Verification code sent to your email.'); this.currentStep = 3; },
      error: (err: any) => { this.showToast(err.error?.message || 'Registration failed.'); }
    });
  }

  verifyOtp() {
    this.api.verifyOtp({ email: this.userData.email, otp: this.otpCode }).subscribe({
      next: (res: any) => {
        localStorage.setItem('user', JSON.stringify(res.user));
        localStorage.setItem('role', res.role);
        this.router.navigate(['/home']);
      },
      error: () => { this.showToast('Invalid verification code.'); }
    });
  }

  async showToast(msg: string) {
    const toast = await this.toastController.create({ message: msg, duration: 3000, position: 'bottom', color: 'danger' });
    await toast.present();
  }
}