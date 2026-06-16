import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { IonContent, IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  standalone: true,
  imports: [CommonModule, IonContent, IonButton]
})
export class WelcomePage implements OnInit {
  // Hides content until we know it's actually a first-time user.
  // Prevents the flash on returning users.
  isFirstTime = false;

  constructor(private router: Router) {}

  async ngOnInit() {
    const seen = localStorage.getItem('welcomeSeen') === 'true';
    if (seen) {
      // Returning user — navigate immediately, never show welcome content
      const user = localStorage.getItem('user');
      const role = localStorage.getItem('role');
      if (user && role) {
        const dest = (role === 'admin' || role === 'dispatcher') ? '/admin-dashboard' : '/home';
        await this.router.navigate([dest], { replaceUrl: true });
      } else {
        await this.router.navigate(['/login'], { replaceUrl: true });
      }
      return;
    }

    // First-time user — show the welcome screen
    this.isFirstTime = true;

    // Ask permissions while they read the screen (native only)
    if (Capacitor.isNativePlatform()) {
      try { await Camera.requestPermissions({ permissions: ['camera', 'photos'] }); } catch { /* ok */ }
      try { await Geolocation.requestPermissions(); } catch { /* ok */ }
    }
  }

  goToLogin() {
    localStorage.setItem('welcomeSeen', 'true');
    this.router.navigate(['/login']);
  }

  goToRegister() {
    localStorage.setItem('welcomeSeen', 'true');
    this.router.navigate(['/register']);
  }
}