import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
  IonContent, IonButton, IonList, IonListHeader,
  IonLabel, IonItem, IonCard, IonCardContent,
  IonSelect, IonSelectOption, IonInput, IonRow, IonCol,
  IonModal, IonToast
} from '@ionic/angular/standalone';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { ApiService } from '../services/api';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
    IonContent, IonButton, IonList, IonListHeader,
    IonLabel, IonItem, IonCard, IonCardContent,
    IonSelect, IonSelectOption, IonInput, IonRow, IonCol,
    IonModal, IonToast,
    ImageCropperComponent
  ]
})
export class ProfilePage implements OnInit {

  userData: any = {};
  calculatedAge: string | number = 'N/A';
  showPasswordForm = false;
  passwords = { current: '', new: '', confirm: '' };
  medicalData = { blood_type: '', allergies: '', medical_conditions: '', pwd_status: '' };

  toastOpen = false;
  toastMessage = '';
  toastColor = 'success';

  showCropper = false;
  cropperFile: File | null = null;
  croppedBase64 = '';

  barangays = [
    { id: 1, name: 'Alua' }, { id: 2, name: 'Calaba' }, { id: 3, name: 'Malapit' },
    { id: 4, name: 'Mangga' }, { id: 5, name: 'Poblacion' }, { id: 6, name: 'Pulo' },
    { id: 7, name: 'San Roque' }, { id: 8, name: 'Santo Cristo' }, { id: 9, name: 'Tabon' }
  ];

  get barangayName(): string {
    return this.barangays.find(b => b.id === this.userData.barangay_id)?.name
        || `Barangay #${this.userData.barangay_id}`;
  }

  // Resolves profile picture URL dynamically from the stored backend URL.
  // The backend always stores the full URL (e.g. http://127.0.0.1:8000/storage/...)
  // so we just use it as-is. If it's the Ionic placeholder, show fallback icon.
  get displayAvatar(): string {
    const pic = this.userData?.profile_picture;
    if (!pic || pic.includes('ionicframework.com')) return '';
    return pic;
  }

  constructor(private api: ApiService) {}

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

  triggerPhotoPicker() { document.getElementById('profilePhotoInput')?.click(); }

  onPhotoFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { this.showToast('Image too large. Max 10MB.', 'warning'); return; }
    this.cropperFile = file;
    this.croppedBase64 = '';
    this.showCropper = true;
    (event.target as HTMLInputElement).value = '';
  }

  onPhotoCropped(event: ImageCroppedEvent) {
    this.croppedBase64 = event.base64 || (event as any).objectUrl || '';
  }

  confirmCrop() {
    if (!this.croppedBase64) {
      this.showToast('Please wait for the image to load, then try again.', 'warning');
      return;
    }
    this.showCropper = false;
    this.api.updateProfilePicture({ user_id: this.userData.user_id, image: this.croppedBase64 }).subscribe({
      next: (res: any) => {
        this.userData = res.user;
        localStorage.setItem('user', JSON.stringify(res.user));
        window.dispatchEvent(new Event('storage'));
        this.showToast('Profile picture updated!', 'success');
      },
      error: () => this.showToast('Failed to update photo.', 'danger')
    });
    this.cropperFile = null;
  }

  cancelCrop() { this.showCropper = false; this.cropperFile = null; this.croppedBase64 = ''; }

  saveMedicalProfile() {
    this.api.updateMedicalProfile({ user_id: this.userData.user_id, ...this.medicalData }).subscribe({
      next: (res: any) => {
        this.userData = res.user;
        localStorage.setItem('user', JSON.stringify(res.user));
        this.showToast('Medical profile saved!', 'success');
      },
      error: () => this.showToast('Failed to save.', 'danger')
    });
  }

  updatePassword() {
    if (this.passwords.new !== this.passwords.confirm) { this.showToast('Passwords do not match.', 'danger'); return; }
    this.api.updatePassword({ user_id: this.userData.user_id, current_password: this.passwords.current, new_password: this.passwords.new }).subscribe({
      next: () => { this.showToast('Password updated!', 'success'); this.passwords = { current: '', new: '', confirm: '' }; this.showPasswordForm = false; },
      error: (err: any) => this.showToast(err.error?.message || 'Update failed.', 'danger')
    });
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