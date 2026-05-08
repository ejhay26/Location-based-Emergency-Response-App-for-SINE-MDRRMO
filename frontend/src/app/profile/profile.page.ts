import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { personOutline, callOutline, mailOutline, locationOutline, calendarOutline, createOutline, lockClosedOutline } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, HttpClientModule]
})
export class ProfilePage implements OnInit {

  userData: any = {};
  calculatedAge: string | number = 'N/A';
  apiUrl = 'http://127.0.0.1:8000/api';

  passwords = { current: '', new: '', confirm: '' };

  constructor(private http: HttpClient, private toastCtrl: ToastController) {
    addIcons({ personOutline, callOutline, mailOutline, locationOutline, calendarOutline, createOutline, lockClosedOutline });
  }

  ngOnInit() {
    this.loadLocalUser();
  }

  loadLocalUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.userData = JSON.parse(userStr);
      if (this.userData.birthdate) this.calculateAge(this.userData.birthdate);
    }
  }

  // ALLOWS Prompt so they can pick from gallery OR camera for their avatar!
  async changePhoto() {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt 
    });

    if (image.dataUrl) {
      this.http.post(`${this.apiUrl}/update-profile-picture`, {
        user_id: this.userData.user_id,
        image: image.dataUrl
      }).subscribe({
        next: (res: any) => {
          this.userData = res.user;
          localStorage.setItem('user', JSON.stringify(res.user));
          this.showToast('Profile picture updated!', 'success');
        }
      });
    }
  }

  updatePassword() {
    if (this.passwords.new !== this.passwords.confirm) {
      this.showToast('New passwords do not match.', 'danger');
      return;
    }

    this.http.post(`${this.apiUrl}/update-password`, {
      user_id: this.userData.user_id,
      current_password: this.passwords.current,
      new_password: this.passwords.new
    }).subscribe({
      next: () => {
        this.showToast('Password updated securely!', 'success');
        this.passwords = { current: '', new: '', confirm: '' }; // clear form
      },
      error: (err) => {
        // Displays the strict regex validation errors from Laravel
        const msg = err.error.message || 'Password update failed.';
        this.showToast(msg, 'danger');
      }
    });
  }

  calculateAge(birthdateStr: string) {
    const birthDate = new Date(birthdateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    this.calculatedAge = age;
  }

  async showToast(msg: string, color: string) {
    const toast = await this.toastCtrl.create({ message: msg, duration: 3000, position: 'bottom', color: color });
    await toast.present();
  }
}