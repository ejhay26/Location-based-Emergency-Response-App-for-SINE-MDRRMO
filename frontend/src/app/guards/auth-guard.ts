import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const user = localStorage.getItem('user');
    const currentRole = localStorage.getItem('role');
    
    // 1. If not logged in at all, kick to login
    if (!user || !currentRole) {
      this.router.navigate(['/login']);
      return false;
    }

    // 2. Check if the page requires specific roles (Now uses an Array!)
    const expectedRoles = route.data?.['roles'] as Array<string>; 
    
    if (expectedRoles && !expectedRoles.includes(currentRole)) {
      // They are logged in, but don't have permission for this page.
      // Safely bounce them to their correct dashboard.
      if (currentRole === 'admin' || currentRole === 'dispatcher') {
        this.router.navigate(['/admin-dashboard']);
      } else {
        this.router.navigate(['/home']);
      }
      return false;
    }

    return true; // They have the right role! Let them in.
  }
}