import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastController, MenuController } from '@ionic/angular';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
  IonContent, IonButton, IonList, IonListHeader, IonLabel,
  IonCard, IonItem, IonBadge
} from '@ionic/angular/standalone';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
    IonContent, IonButton, IonList, IonListHeader, IonLabel,
    IonCard, IonItem, IonBadge
  ],
})
export class HomePage {
  recentRequests: any[] = [];
  userFullName: string = '';
  activeBroadcast: any = null;

  constructor(
    private router: Router,
    private menuCtrl: MenuController,
    private api: ApiService,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter() {
    this.menuCtrl.enable(true);
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      this.userFullName = `${user.first_name} ${user.last_name}`;
    }
    this.loadMyEmergencies();
    this.fetchBroadcast();
  }

  fetchBroadcast() {
    this.api.getActiveBroadcast().subscribe({
      next: (res: any) => { this.activeBroadcast = (res && res.message) ? res : null; }
    });
  }

  loadMyEmergencies() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      this.api.getMyEmergencies(user.user_id).subscribe({
        next: (res: any) => { this.recentRequests = res.length > 0 ? [res[0]] : []; }
      });
    }
  }

  cancelRequest(requestId: number) {
    const user = JSON.parse(localStorage.getItem('user')!);
    this.api.cancelEmergency({ request_id: requestId, user_id: user.user_id }).subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({ message: 'Emergency request cancelled.', duration: 2000, color: 'medium' });
        toast.present();
        this.loadMyEmergencies();
      }
    });
  }

  goToSos()    { this.router.navigate(['/report'], { queryParams: { type: 'emergency' } }); }
  goToHazard() { this.router.navigate(['/report'], { queryParams: { type: 'hazard'    } }); }
}