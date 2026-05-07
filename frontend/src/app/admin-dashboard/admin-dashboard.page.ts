import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.page.html',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class AdminDashboardPage implements OnInit {
  
  // Empty array waiting for the real database data
  activeRequests: any[] = [];

  constructor(private router: Router) {
    addIcons({ logOutOutline });
  }

  ngOnInit() {
    // We will build the fetch logic here later to grab real DB records
    // this.fetchActiveEmergencies();
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    this.router.navigate(['/login']);
  }
}