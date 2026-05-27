import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ProfilePage implements OnInit {

  userData: any = {};
  calculatedAge: string | number = 'N/A';
  showPasswordForm = false;
  passwords = { current: '', new: '', confirm: '' };
  medicalData = { blood_type: '', allergies: '', medical_conditions: '', pwd_status: '' };

  constructor(private api: ApiService, private toastCtrl: ToastController) {}

  ngOnInit() { this.loadLocalUser(); }

  loadLocalUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.userData = JSON.parse(userStr);
      if (this.userData.birthdate) this.calculateAge(this.userData.birthdate);
      this.medicalData = {
        blood_type:         this.userData.blood_type         || '',
        allergies:          this.userData.allergies          || '',
        medical_conditions: this.userData.medical_conditions || '',
        pwd_status:         this.userData.pwd_status         || ''
      };
    }
  }

  async changePhoto() {
    const image = await Camera.getPhoto({ quality: 90, allowEditing: true, resultType: CameraResultType.DataUrl, source: CameraSource.Prompt });
    if (image.dataUrl) {
      this.api.updateProfilePicture({ user_id: this.userData.user_id, image: image.dataUrl }).subscribe({
        next: (res: any) => {
          this.userData = res.user;
          localStorage.setItem('user', JSON.stringify(res.user));
          this.showToast('Profile picture updated!', 'success');
        }
      });
    }
  }

  saveMedicalProfile() {
    this.api.updateMedicalProfile({ user_id: this.userData.user_id, ...this.medicalData }).subscribe({
      next: (res: any) => {
        this.userData = res.user;
        localStorage.setItem('user', JSON.stringify(res.user));
        this.showToast('Medical profile saved!', 'success');
      },
      error: () => this.showToast('Failed to save medical data.', 'danger')
    });
  }

  updatePassword() {
    if (this.passwords.new !== this.passwords.confirm) {
      this.showToast('New passwords do not match.', 'danger'); return;
    }
    this.api.updatePassword({
      user_id: this.userData.user_id,
      current_password: this.passwords.current,
      new_password: this.passwords.new
    }).subscribe({
      next: () => {
        this.showToast('Password updated!', 'success');
        this.passwords = { current: '', new: '', confirm: '' };
        this.showPasswordForm = false;
      },
      error: (err: any) => this.showToast(err.error?.message || 'Password update failed.', 'danger')
    });
  }

  calculateAge(birthdateStr: string) {
    const birth = new Date(birthdateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    this.calculatedAge = age;
  }

  async showToast(msg: string, color: string) {
    const toast = await this.toastCtrl.create({ message: msg, duration: 3000, position: 'bottom', color });
    await toast.present();
  }
}