import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, MenuController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { logOutOutline, closeCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  standalone: true,
  imports: [IonicModule, CommonModule, HttpClientModule],
})
export class HomePage {
  recentRequests: any[] = [];
  userFullName: string = '';
  apiUrl = 'http://127.0.0.1:8000/api';
  
  constructor(
    private router: Router, 
    private menuCtrl: MenuController,
    private http: HttpClient,
    private toastCtrl: ToastController
  ) {
    addIcons({ logOutOutline, closeCircleOutline });
  }

  ionViewWillEnter() {
    this.menuCtrl.enable(true);
    
    // Load user name for the welcome banner
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      this.userFullName = `${user.first_name} ${user.last_name}`;
    }

    this.loadMyEmergencies();
  }

  loadMyEmergencies() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      this.http.get(`${this.apiUrl}/my-emergencies/${user.user_id}`).subscribe({
        next: (res: any) => {
          // RESTRICTION: Only grab the very first (most recent) request to prevent lag
          this.recentRequests = res.length > 0 ? [res[0]] : [];
        },
        error: (err) => console.error("Failed to load emergencies", err)
      });
    }
  }

  cancelRequest(requestId: number) {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    this.http.post(`${this.apiUrl}/cancel-sos`, { request_id: requestId, user_id: user.user_id }).subscribe({
      next: async (res: any) => {
        const toast = await this.toastCtrl.create({ message: 'Request Cancelled.', duration: 2000, color: 'medium' });
        toast.present();
        this.loadMyEmergencies(); 
      },
      error: async (err) => {
        const toast = await this.toastCtrl.create({ message: err.error.message, duration: 3000, color: 'danger' });
        toast.present();
      }
    });
  }

  logout() {
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }

  goToSos(){
    this.router.navigate(['/sos']);
  }
}