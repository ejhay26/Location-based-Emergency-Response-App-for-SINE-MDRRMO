import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { ApiService } from '../services/api';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  standalone: true,
  // Notice we use ReactiveFormsModule here instead of FormsModule
  imports: [IonicModule, CommonModule, ReactiveFormsModule, RouterModule], 
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LoginPage {
  loginForm: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    private apiService: ApiService, 
    private router: Router,
    private toastController: ToastController
  ) {
    // This initializes the form that your HTML is looking for
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  login() {
    // Stop if the form is empty or invalid
    if (this.loginForm.invalid) {
      this.showToast('Please enter a valid email/username and password.', 'warning');
      return;
    }

    // this.loginForm.value automatically packages the email and password
    this.apiService.login(this.loginForm.value).subscribe({
      next: (response) => {
        console.log('Login Success:', response);
        this.showToast('Login successful!', 'success');
        
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('role', response.role);
        
        // Route them based on their role!
        if (response.role === 'admin') {
          this.router.navigate(['/admin-dashboard']);
        } else {
          this.router.navigate(['/home']); 
        }
      },
      error: (error) => {
        console.error('Login Failed:', error);
        this.showToast('Invalid credentials. Please try again.', 'danger');
      }
    });
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      color: color,
      position: 'top'
    });
    toast.present();
  }
}