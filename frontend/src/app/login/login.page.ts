import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, MenuController} from '@ionic/angular';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, HttpClientModule, RouterModule]
})
export class LoginPage {
  
  credentials = { login: '', password: '' };
  
  // NEW: State for Forgot Password flow
  viewMode: 'login' | 'forgot' | 'reset' = 'login';
  resetData = { email: '', otp: '', new_password: '' };
  
  apiUrl = 'http://127.0.0.1:8000/api';

  constructor(
    private router: Router, 
    private http: HttpClient,
    private toastController: ToastController,
    private menuCtrl: MenuController
  ) {}

  ionViewWillEnter() {
    this.menuCtrl.enable(false);
  }

  // --- STANDARD LOGIN ---
  login() {
    if (!this.credentials.login || !this.credentials.password) {
      this.showToast('Please enter both email and password.', 'warning');
      return;
    }

    this.http.post(`${this.apiUrl}/login`, this.credentials).subscribe({
      next: (res: any) => {
        localStorage.setItem('user', JSON.stringify(res.user));
        localStorage.setItem('role', res.role);

        if (res.role === 'admin' || res.role === 'dispatcher') {
          this.router.navigate(['/admin-dashboard']);
        } else {
          this.router.navigate(['/home']);
        }
      },
      error: (err) => {
        this.showToast('Invalid email or password.', 'danger');
      }
    });
  }

  // --- FORGOT PASSWORD FLOW ---
  requestReset() {
    if (!this.resetData.email) {
      this.showToast('Please enter your email.', 'warning');
      return;
    }

    this.http.post(`${this.apiUrl}/forgot-password`, { email: this.resetData.email }).subscribe({
      next: () => {
        this.showToast('An OTP has been sent to your email.', 'success');
        this.viewMode = 'reset';
      },
      error: () => this.showToast('Failed to send reset email.', 'danger')
    });
  }

  confirmReset() {
    if (!this.resetData.otp || !this.resetData.new_password) {
      this.showToast('Please fill out all fields.', 'warning');
      return;
    }

    this.http.post(`${this.apiUrl}/reset-password`, this.resetData).subscribe({
      next: () => {
        this.showToast('Password reset successfully! You can now log in.', 'success');
        this.viewMode = 'login';
        this.resetData = { email: '', otp: '', new_password: '' }; // Clear memory
      },
      error: (err) => {
        const msg = err.error.message || 'Invalid OTP or weak password.';
        this.showToast(msg, 'danger');
      }
    });
  }

  async showToast(msg: string, color: string) {
    const toast = await this.toastController.create({
      message: msg, duration: 3000, position: 'bottom', color: color
    });
    await toast.present();
  }
}