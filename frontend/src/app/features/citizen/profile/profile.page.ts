import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonList, IonListHeader,
  IonLabel, IonItem, IonToast, AlertController,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api';
import { UserSettingsService } from '../../../core/services/user-settings';
import { LocationService } from '../../../core/services/location';
import { ImageCacheService } from '../../../core/services/image-cache';
import { PushNotificationsService } from '../../../core/services/push-notifications';
import { ProfilePhotoComponent } from './components/profile-photo/profile-photo.component';
import { ProfileMedicalComponent, MedicalData } from './components/profile-medical/profile-medical.component';
import { ProfilePasswordComponent } from './components/profile-password/profile-password.component';
import { ToastRequest } from './components/profile-shared-types';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonList, IonListHeader,
    IonLabel, IonItem, IonToast,
    ProfilePhotoComponent, ProfileMedicalComponent, ProfilePasswordComponent
  ]
})
export class ProfilePage implements OnInit, OnDestroy {

  private api        = inject(ApiService);
  private alertCtrl  = inject(AlertController);
  private router     = inject(Router);
  private settings   = inject(UserSettingsService);
  private locationSvc = inject(LocationService);
  private imageCache  = inject(ImageCacheService);
  private pushNotifications = inject(PushNotificationsService);

  userData: any = {};
  calculatedAge: string | number = 'N/A';

  medicalData: MedicalData = { blood_type: '', allergies: '', medical_conditions: '', pwd_status: '' };

  toastOpen    = false;
  toastMessage = '';
  toastColor   = 'success';

  barangays = [
    { id: 1, name: 'Alua' }, { id: 2, name: 'Calaba' }, { id: 3, name: 'Malapit' },
    { id: 4, name: 'Mangga' }, { id: 5, name: 'Poblacion' }, { id: 6, name: 'Pulo' },
    { id: 7, name: 'San Roque' }, { id: 8, name: 'Santo Cristo' }, { id: 9, name: 'Tabon' }
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

  private storageListener = () => this.loadLocalUser();

  async ngOnInit() {
    await this.loadLocalUser();
    window.addEventListener('storage', this.storageListener);
  }

  ngOnDestroy() {
    window.removeEventListener('storage', this.storageListener);
  }

  async loadLocalUser() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    try { this.userData = JSON.parse(userStr); } catch { localStorage.removeItem('user'); return; }
    if (!this.userData?.user_id) { this.userData = {}; return; }
    if (this.userData.birthdate) this.calculateAge(this.userData.birthdate);
    this.medicalData = {
      blood_type:         this.userData.blood_type         || '',
      allergies:          this.userData.allergies          || '',
      medical_conditions: this.userData.medical_conditions || '',
      pwd_status:         this.userData.pwd_status         || '',
    };
  }

  onUserUpdated(user: any) {
    this.userData = user;
    localStorage.setItem('user', JSON.stringify(user));
  }

  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Logout', message: 'Are you sure you want to log out?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Logout', role: 'confirm', cssClass: 'alert-button-danger', handler: () => {
          this.pushNotifications.unregisterPush();
          this.api.logout().subscribe({ error: () => {} });
          this.locationSvc.stop(); this.api.clearToken(); this.imageCache.clear(); this.settings.clear();
          localStorage.removeItem('user'); localStorage.removeItem('role');
          document.documentElement.classList.remove('ion-palette-dark');
          this.router.navigate(['/login']);
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

  onToast(req: ToastRequest) {
    this.showToast(req.msg, req.color);
  }
}
