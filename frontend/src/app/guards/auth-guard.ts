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
    if (!user) {
      this.router.navigate(['/login']);
      return false;
    }

    // 2. Check if the page requires a specific role
    const expectedRole = route.data?.['role']; 
    
    if (expectedRole && currentRole !== expectedRole) {
      // They are logged in, but don't have permission for this specific page.
      // Send them to their correct dashboard safely.
      if (currentRole === 'admin') {
        this.router.navigate(['/admin-dashboard']);
      } else {
        this.router.navigate(['/home']);
      }
      return false;
    }

    return true; // They are logged in AND have the right role. Let them in!
  }
}