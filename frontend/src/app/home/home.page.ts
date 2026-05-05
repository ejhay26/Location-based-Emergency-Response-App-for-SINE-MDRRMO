import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  standalone: true,
  imports: [IonicModule],
})
export class HomePage {
  recentRequests: any[] = [];
  
  constructor(private router: Router) {
    // Register the logout icon so Ionic can render it
    addIcons({ logOutOutline });
  }

  logout() {
    // Clear the saved user data
    localStorage.removeItem('user');
    // Send them back to the login screen
    this.router.navigate(['/login']);
  }
}