import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { personOutline, callOutline, mailOutline, locationOutline, calendarOutline, createOutline, lockClosedOutline, medkitOutline, saveOutline } from 'ionicons/icons';
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

  // NEW: State to hide/show the password form
  showPasswordForm: boolean = false;
  passwords = { current: '', new: '', confirm: '' };
  
  medicalData = { blood_type: '', allergies: '', medical_conditions: '', pwd_status: '' };

  constructor(private http: HttpClient, private toastCtrl: ToastController) {
    addIcons({ personOutline, callOutline, mailOutline, locationOutline, calendarOutline, createOutline, lockClosedOutline, medkitOutline, saveOutline });
  }

  ngOnInit() {
    this.loadLocalUser();
  }

  loadLocalUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.userData = JSON.parse(userStr);
      if (this.userData.birthdate) this.calculateAge(this.userData.birthdate);
      
      this.medicalData = {
        blood_type: this.userData.blood_type || '',
        allergies: this.userData.allergies || '',
        medical_conditions: this.userData.medical_conditions || '',
        pwd_status: this.userData.pwd_status || ''
      };
    }
  }

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

  saveMedicalProfile() {
    this.http.post(`${this.apiUrl}/update-medical-profile`, {
      user_id: this.userData.user_id,
      ...this.medicalData
    }).subscribe({
      next: (res: any) => {
        this.userData = res.user;
        localStorage.setItem('user', JSON.stringify(res.user));
        this.showToast('Medical & Vulnerability Profile Saved!', 'success');
      },
      error: () => this.showToast('Failed to save medical data.', 'danger')
    });
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
        this.passwords = { current: '', new: '', confirm: '' }; 
        this.showPasswordForm = false; // Hide form on success!
      },
      error: (err) => {
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