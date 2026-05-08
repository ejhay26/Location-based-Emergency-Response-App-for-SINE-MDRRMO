import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { mailUnreadOutline } from 'ionicons/icons';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, HttpClientModule]
})
export class RegisterPage {
  
  currentStep = 1;
  otpCode = '';
  
  barangays = [
    { id: 1, name: 'Alua' }, { id: 2, name: 'Calaba' }, { id: 3, name: 'Malapit' },
    { id: 4, name: 'Mangga' }, { id: 5, name: 'Poblacion' }, { id: 6, name: 'Pulo' },
    { id: 7, name: 'San Roque' }, { id: 8, name: 'Santo Cristo' }, { id: 9, name: 'Tabon' }
  ];

  userData = {
    first_name: '', last_name: '', phone: '', birthdate: '', username: '',
    email: '', password: '', confirm_password: '', barangay_id: null
  };

  apiUrl = 'http://127.0.0.1:8000/api'; 

  constructor(
    private router: Router, 
    private http: HttpClient,
    private toastController: ToastController
  ) {
    addIcons({ mailUnreadOutline });
  }

  nextStep() {
    if (this.currentStep === 1) {
      if (!this.userData.first_name || !this.userData.last_name || !this.userData.phone || !this.userData.birthdate) {
        this.showToast('Please fill out all personal details.');
        return;
      }
    }
    if (this.currentStep === 2) {
      if (!this.userData.username || !this.userData.email || !this.userData.barangay_id) {
        this.showToast('Please fill out all account details.');
        return;
      }
      
      // Strict Password Validation Check (Regex)
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
      if (!passwordRegex.test(this.userData.password)) {
        this.showToast('Password must be 8+ chars with uppercase, lowercase, number, & symbol.');
        return;
      }

      if (this.userData.password !== this.userData.confirm_password) {
        this.showToast('Passwords do not match.');
        return;
      }
      
      this.submitRegistration();
      return; // Stop here, the HTTP request will advance to step 3
    }
    
    this.currentStep++;
  }

  prevStep() {
    if (this.currentStep > 1) this.currentStep--;
  }

  async submitRegistration() {
    this.http.post(`${this.apiUrl}/register`, this.userData).subscribe({
      next: (res: any) => {
        this.showToast('Verification code sent to your email!');
        this.currentStep = 3; 
      },
      error: (err) => {
        // Automatically show the backend validation errors (like "Username taken")
        const errorMsg = err.error.message || 'Registration failed.';
        this.showToast(errorMsg);
      }
    });
  }

  async verifyOtp() {
    const payload = { email: this.userData.email, otp: this.otpCode };
    this.http.post(`${this.apiUrl}/verify-otp`, payload).subscribe({
      next: (res: any) => {
        localStorage.setItem('user', JSON.stringify(res.user));
        localStorage.setItem('role', res.role);
        this.showToast('Welcome to SINE MDRRMO!');
        this.router.navigate(['/home']);
      },
      error: () => {
        this.showToast('Invalid OTP code.');
      }
    });
  }

  async showToast(msg: string) {
    const toast = await this.toastController.create({
      message: msg,
      duration: 3000,
      position: 'bottom',
      color: 'danger' // Applied global theme color
    });
    await toast.present();
  }
}