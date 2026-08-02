import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const user = localStorage.getItem('user');
    const currentRole = localStorage.getItem('role');

    if (!user || !currentRole) {
      this.router.navigate(['/login']);
      return false;
    }

    // Block admin/dispatcher from logging in on native mobile apps.
    // The admin dashboard is Electron/browser only.
    const isNative = Capacitor.isNativePlatform(); // true on Android & iOS
    if (isNative && (currentRole === 'admin' || currentRole === 'dispatcher')) {
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      this.router.navigate(['/login']);
      return false;
    }

    const expectedRoles = route.data?.['roles'] as Array<string>;
    if (expectedRoles && !expectedRoles.includes(currentRole)) {
      if (currentRole === 'admin' || currentRole === 'dispatcher') {
        this.router.navigate(['/admin-dashboard']);
      } else {
        this.router.navigate(['/tabs/home']);
      }
      return false;
    }

    return true;
  }
}
