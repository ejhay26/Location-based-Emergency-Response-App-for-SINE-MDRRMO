import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, MenuController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { logOutOutline, closeCircleOutline, warningOutline, alertCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  standalone: true,
  imports: [IonicModule, CommonModule, HttpClientModule],
})
export class HomePage {
  recentRequests: any[] = [];
  userFullName: string = '';
  activeBroadcast: any = null;
  apiUrl = 'http://127.0.0.1:8000/api';
  
  constructor(
    private router: Router, 
    private menuCtrl: MenuController,
    private http: HttpClient,
    private toastCtrl: ToastController
  ) {
    addIcons({ logOutOutline, closeCircleOutline, warningOutline, alertCircleOutline });
  }

  ionViewWillEnter() {
    this.menuCtrl.enable(true);
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      this.userFullName = `${user.first_name} ${user.last_name}`;
    }

    this.loadMyEmergencies();
    this.fetchBroadcast(); // NEW: Fetch the active marquee
  }

  fetchBroadcast() {
    this.http.get(`${this.apiUrl}/active-broadcast`).subscribe({
      next: (res: any) => {
        if (res && res.message) {
          this.activeBroadcast = res;
        }
      }
    });
  }

  loadMyEmergencies() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      this.http.get(`${this.apiUrl}/my-emergencies/${user.user_id}`).subscribe({
        next: (res: any) => {
          this.recentRequests = res.length > 0 ? [res[0]] : [];
        }
      });
    }
  }

  cancelRequest(requestId: number) {
    const user = JSON.parse(localStorage.getItem('user')!);
    this.http.post(`${this.apiUrl}/cancel-sos`, { request_id: requestId, user_id: user.user_id }).subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({ message: 'Request Cancelled.', duration: 2000, color: 'medium' });
        toast.present();
        this.loadMyEmergencies(); 
      }
    });
  }

  goToSos() { this.router.navigate(['/sos']); }
  goToHazard() { this.router.navigate(['/hazard']); } // NEW: Navigate to hazard page
}