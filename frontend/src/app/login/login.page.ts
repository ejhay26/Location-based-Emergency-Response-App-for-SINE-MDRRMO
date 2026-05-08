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
  apiUrl = 'http://127.0.0.1:8000/api';

  constructor(
    private router: Router, 
    private http: HttpClient,
    private toastController: ToastController,
    private menuCtrl: MenuController // Injected MenuController
  ) {}

  // THE LOCK: Completely disables the menu on the login screen
  ionViewWillEnter() {
    this.menuCtrl.enable(false);
  }

  login() {
    if (!this.credentials.login || !this.credentials.password) {
      this.showToast('Please enter both email and password.');
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
        this.showToast('Invalid email or password.');
      }
    });
  }

  async showToast(msg: string) {
    const toast = await this.toastController.create({
      message: msg, duration: 3000, position: 'bottom', color: 'danger'
    });
    await toast.present();
  }
}