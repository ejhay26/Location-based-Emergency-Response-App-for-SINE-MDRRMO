import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class GuestGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean {
    const user = localStorage.getItem('user');
    const role = localStorage.getItem('role');
    
    // If they are already logged in, send them away from the auth pages
    if (user) {
      if (role === 'admin') {
        this.router.navigate(['/admin-dashboard']);
      } else {
        this.router.navigate(['/home']);
      }
      return false; // Block access to login/register
    }
    
    return true; // Let them see the login/register page
  }
}