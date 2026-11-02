import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';

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
